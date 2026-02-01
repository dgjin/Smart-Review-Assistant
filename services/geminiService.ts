
import { GoogleGenAI, Type } from "@google/genai";
import { Rule, ReviewDocument, ExtractedInfo, Language, ModelProvider, ReferenceDocument, AISettings } from "../types";

// 默认端点
const DEEPSEEK_DEFAULT_URL = 'https://api.deepseek.com/v1';
const MINIMAX_DEFAULT_URL = 'https://api.minimax.chat/v1';

/**
 * 获取本地配置信息
 */
const getExternalSettings = (): AISettings => {
  const saved = localStorage.getItem('sra_ai_settings');
  if (saved) return JSON.parse(saved);
  return { deepseekKey: '', deepseekBaseUrl: '', minimaxKey: '' };
};

/**
 * 通用重试逻辑 (指数退避)
 * 用于应对 429 (Resource Exhausted) 或 临时网络抖动
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = String(error?.message || error || "").toLowerCase();
    const isQuotaError = errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('quota');
    
    if (retries > 0 && (isQuotaError || error?.status === 503 || error?.status === 500)) {
      console.warn(`API 请求受限或失败，${delay}ms 后进行第 ${4 - retries} 次重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * 核心适配器：统一处理不同厂商的 Chat Completion 调用
 */
async function unifiedChat(params: {
  provider: ModelProvider;
  systemInstruction: string;
  prompt: string;
  isJson?: boolean;
  temperature?: number;
  language: Language;
}): Promise<string> {
  const { provider, systemInstruction, prompt, isJson, temperature: paramTemp, language } = params;
  const settings = getExternalSettings();
  
  // 针对分析速度进行参数优化：非 Gemini 引擎默认使用更低的温度以减少推理采样时间
  const temperature = paramTemp ?? (provider === 'Gemini' ? 0.7 : 0.1);

  // 1. Gemini 调用 (支持自动重试与降级)
  const callGemini = async (preferredModel: string = 'gemini-3-pro-preview'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    return withRetry(async () => {
      try {
        const response = await ai.models.generateContent({
          model: preferredModel,
          contents: prompt,
          config: {
            systemInstruction: `${systemInstruction}\n\nIMPORTANT: Please respond strictly in ${language === 'zh' ? 'Chinese' : 'English'}.`, 
            temperature,
            responseMimeType: isJson ? "application/json" : "text/plain",
            thinkingConfig: preferredModel.includes('pro') ? { thinkingBudget: 8000 } : undefined
          }
        });
        return response.text || "";
      } catch (err: any) {
        const errorStr = String(err?.message || "").toLowerCase();
        // 如果 Pro 模型配额用尽，尝试降级到 Flash 模型
        if ((errorStr.includes('429') || errorStr.includes('resource_exhausted')) && preferredModel === 'gemini-3-pro-preview') {
          console.warn("Gemini Pro 配额超限，自动降级至 Gemini Flash 处理...");
          return callGemini('gemini-3-flash-preview');
        }
        throw err;
      }
    });
  };

  if (provider === 'Gemini' || !provider) {
    return callGemini();
  }

  // 2. DeepSeek 调用
  if (provider === 'DeepSeek') {
    const apiKey = settings.deepseekKey || process.env.API_KEY || "";
    if (!apiKey) return callGemini();
    
    let baseUrl = (settings.deepseekBaseUrl || DEEPSEEK_DEFAULT_URL).trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    try {
      const response = await withRetry(async () => {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: `${systemInstruction}\n\n请务必使用${language === 'zh' ? '中文' : '英文'}回答。` },
              { role: "user", content: prompt }
            ],
            ...(isJson ? { response_format: { type: "json_object" } } : {}),
            temperature,
            max_tokens: 4096 
          })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || data.message || `HTTP ${res.status}`);
        }
        return res;
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      console.error("DeepSeek Error:", err);
      return callGemini('gemini-3-flash-preview');
    }
  }

  // 3. MiniMax 调用
  if (provider === 'MiniMax') {
    const apiKey = settings.minimaxKey || process.env.API_KEY || "";
    if (!apiKey) return callGemini();

    try {
      const response = await withRetry(async () => {
        const res = await fetch(`${MINIMAX_DEFAULT_URL}/text/chatcompletion_v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "minimax-m2.1",
            messages: [
              { role: "system", content: `${systemInstruction.split('\n')[0]} 请使用${language === 'zh' ? '中文' : '英文'}简洁专业地回答。` },
              { role: "user", content: prompt }
            ],
            temperature,
            top_p: 0.9,
            stream: false 
          })
        });
        
        const data = await res.json();
        if (data.base_resp && data.base_resp.status_code !== 0) {
          throw new Error(data.base_resp.status_msg || "MiniMax API Error");
        }
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        return data;
      });

      return response.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      console.error("MiniMax Error:", err);
      return callGemini('gemini-3-flash-preview');
    }
  }

  return callGemini();
}

/**
 * 获取相关上下文
 */
const getRelevantContext = (query: string, items: (Rule | ReferenceDocument)[], isExternalProvider: boolean = false): string => {
  if (!query) return items.slice(0, 5).map(i => `[${i.title}] ${i.content}`).join('\n');
  
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);
  const scored = items.map(item => {
    let score = 0;
    const fullText = `${item.title} ${item.content}`.toLowerCase();
    keywords.forEach(kw => { if (fullText.includes(kw)) score += fullText.includes(item.title.toLowerCase()) ? 10 : 1; });
    return { item, score };
  });

  const limit = isExternalProvider ? 8 : 15;
  
  return scored.sort((a, b) => b.score - a.score).filter(s => s.score > 0).slice(0, limit)
    .map(s => `[SOURCE: ${s.item.title}] ${s.item.content}`).join('\n\n');
};

export const performOCR = async (fileName: string, base64Data: string, mimeType: string, language: Language): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          { text: language === 'zh' ? "请精确提取图中所有文字内容。" : "Extract all text from this document accurately." }, 
          { inlineData: { mimeType, data: base64Data } }
        ] 
      }
    });
    return response.text || "";
  });
};

export const queryKnowledgeBase = async (query: string, allItems: (Rule | ReferenceDocument)[], language: Language, provider: ModelProvider = 'Gemini'): Promise<string> => {
  const isExternal = provider !== 'Gemini';
  const context = getRelevantContext(query, allItems, isExternal);
  return unifiedChat({
    provider,
    language,
    systemInstruction: `You are an expert knowledge assistant. Answer based on provided context only.`,
    prompt: `Context:\n${context}\n\nQuestion: ${query}\nAnswer:`
  });
};

export const extractKeyInformation = async (docs: ReviewDocument[], rules: Rule[], language: Language, provider: ModelProvider = 'Gemini', references: ReferenceDocument[] = []): Promise<ExtractedInfo[]> => {
  const isExternal = provider !== 'Gemini';
  const ruleCtx = rules.filter(r => r.active).map(r => `[RULE] ${r.title}: ${r.content}`).join('\n');
  const refCtx = references.filter(r => r.active).map(r => `[REF] ${r.title}: ${r.content}`).join('\n');
  let docCombined = "";
  docs.forEach(doc => {
    const text = doc.extractedText || doc.content;
    const content = isExternal ? text.substring(0, 6000) : text;
    docCombined += `\n--- DOC: ${doc.name} ---\n${content}\n`;
  });

  const res = await unifiedChat({
    provider,
    language,
    isJson: true,
    systemInstruction: `Extract key info/risks as JSON array: { "field", "value", "sourceContext", "riskLevel": "Low"|"Medium"|"High" }.`,
    prompt: `Rules:\n${ruleCtx}\n${refCtx}\n\nDocs:\n${docCombined}`
  });
  try { return JSON.parse(res); } catch (e) { return []; }
};

export const generateSummary = async (docs: ReviewDocument[], language: Language, provider: ModelProvider = 'Gemini', customPrompt?: string): Promise<string> => {
  const isExternal = provider !== 'Gemini';
  let docCombined = "";
  docs.forEach(doc => {
    const text = doc.extractedText || doc.content;
    const content = isExternal ? text.substring(0, 8000) : text;
    docCombined += `\n--- DOC: ${doc.name} ---\n${content}\n`;
  });
  return unifiedChat({
    provider,
    language,
    systemInstruction: `Create an executive summary. Be concise.`,
    prompt: `${customPrompt || ''}\n\nDocs:\n${docCombined}`
  });
};

export const draftReviewOpinion = async (docs: ReviewDocument[], rules: Rule[], info: ExtractedInfo[], language: Language, provider: ModelProvider = 'Gemini'): Promise<string> => {
  const isExternal = provider !== 'Gemini';
  let docCombined = "";
  docs.forEach(doc => {
    const text = doc.extractedText || doc.content;
    const content = isExternal ? text.substring(0, 5000) : text;
    docCombined += `\n--- DOC: ${doc.name} ---\n${content}\n`;
  });
  return unifiedChat({
    provider,
    language,
    systemInstruction: `Draft a formal audit report. Focus on critical findings and compliance risks.`,
    prompt: `Findings:\n${JSON.stringify(info)}\n\nDocs:\n${docCombined}`
  });
};

export const categorizeText = async (text: string, allowedCategories: string[], provider: ModelProvider = 'Gemini', language: Language = 'zh'): Promise<string> => {
  const res = await unifiedChat({
    provider,
    language,
    systemInstruction: `Classify the provided text into ONE of the following categories: ${allowedCategories.join(', ')}. Return ONLY the category name.`,
    prompt: `Text to categorize: ${text.substring(0, 2000)}`
  });
  return res.trim();
};

export const extractKeywords = async (text: string, count: number = 5, provider: ModelProvider = 'Gemini', language: Language = 'zh'): Promise<string[]> => {
  const res = await unifiedChat({
    provider,
    language,
    isJson: true,
    systemInstruction: `Extract exactly ${count} keywords from the text. Return the result as a JSON array of strings.`,
    prompt: `Text: ${text.substring(0, 2000)}`
  });
  try {
    const parsed = JSON.parse(res);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const matchBooleanQuery = (text: string, query: string): boolean => {
  if (!query) return true;
  const target = text.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  
  const mustHave = tokens.filter(t => !t.startsWith('-') && t !== 'and' && t !== 'or');
  const mustNotHave = tokens.filter(t => t.startsWith('-')).map(t => t.substring(1));

  const hasAllMust = mustHave.every(token => target.includes(token));
  const hasAnyNot = mustNotHave.some(token => target.includes(token));

  return hasAllMust && !hasAnyNot;
};

export const generateIllustration = async (docs: ReviewDocument[], language: Language): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const docText = docs.map(d => d.extractedText || d.content).join('\n').substring(0, 4000);
  const prompt = language === 'zh' 
    ? `基于以下文档内容创作一张富有象征意义的商业插画：\n${docText}`
    : `Create a symbolic, high-quality business illustration based on this content:\n${docText}`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : "";
  });
};

export const generateCreativeVisual = async (content: string, type: string, language: Language, theme: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Create a professional ${type} visual metaphor with a ${theme} style for the following concept: ${content.substring(0, 1000)}.`;
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : "";
  });
};

export const reimagineVisual = async (base64Image: string, instruction: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data } },
          { text: `Re-imagine this image with these changes: ${instruction}` }
        ]
      }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : "";
  });
};
