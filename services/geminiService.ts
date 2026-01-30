
// Fix: Always use import {GoogleGenAI} from "@google/genai";
import { GoogleGenAI, Type } from "@google/genai";
import { Rule, ReviewDocument, ExtractedInfo, Language, ModelProvider } from "../types";

// Fix: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to format rules for the prompt
const formatRules = (rules: Rule[]): string => {
  return rules
    .filter(r => r.active)
    .map(r => `[${r.category}] ${r.title}: ${r.content}`)
    .join('\n\n');
};

// --- GEMINI SPECIFIC HELPERS ---

// Helper to construct parts for Gemini content (Mixed text and inline data)
const buildGeminiPromptParts = (instruction: string, rules: Rule[], docs: ReviewDocument[]) => {
  const ruleContext = formatRules(rules);
  const parts: any[] = [];
  
  parts.push({
    text: `${instruction}\n\nRULES:\n${ruleContext}\n\nPROPOSAL DOCUMENTS (See below):`
  });

  docs.forEach(doc => {
    parts.push({ text: `\n\n--- START DOCUMENT: ${doc.name} ---\n` });

    if (doc.mimeType === 'application/pdf' && doc.type === 'pdf') {
       parts.push({ text: `(PDF Attachment: ${doc.name})` });
       parts.push({
         inlineData: {
           mimeType: doc.mimeType,
           data: doc.content // Base64 string
         }
       });
    } else {
       parts.push({ text: doc.content });
    }
    
    parts.push({ text: `\n--- END DOCUMENT: ${doc.name} ---\n` });
  });

  return parts;
};

// --- DEEPSEEK / OPENAI COMPATIBLE HELPERS ---

const callDeepSeek = async (messages: any[], maxTokens = 4000) => {
    const deepSeekKey = process.env.DEEPSEEK_API_KEY || process.env.API_KEY; // Fallback for demo
    
    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepSeekKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", // V3
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${err}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (e) {
        console.error("DeepSeek Call Failed", e);
        throw e;
    }
};

const buildDeepSeekMessages = (instruction: string, rules: Rule[], docs: ReviewDocument[]) => {
    const ruleContext = formatRules(rules);
    
    let userContent = `RULES:\n${ruleContext}\n\nPROPOSAL DOCUMENTS:\n`;
    
    docs.forEach(doc => {
        userContent += `\n--- START DOCUMENT: ${doc.name} ---\n`;
        // DeepSeek V3 is text-only usually, so use extracted text if available for PDF
        if (doc.type === 'pdf' && doc.extractedText) {
             userContent += doc.extractedText;
        } else if (doc.type === 'pdf' && !doc.extractedText) {
             userContent += "[PDF Content: Warning - Text could not be extracted client-side. Output may be inaccurate.]";
        } else {
             userContent += doc.content;
        }
        userContent += `\n--- END DOCUMENT: ${doc.name} ---\n`;
    });

    return [
        { role: "system", content: instruction },
        { role: "user", content: userContent }
    ];
};

// --- MAIN EXPORTED FUNCTIONS ---

export const extractKeyInformation = async (
  docs: ReviewDocument[],
  rules: Rule[],
  language: Language,
  provider: ModelProvider = 'Gemini'
): Promise<ExtractedInfo[]> => {
  const langInstruction = language === 'zh' 
    ? "Please ensure the 'field', 'value', and 'sourceContext' in the JSON output are in Chinese (Simplified)." 
    : "Please ensure the output is in English.";

  const instruction = `
      You are an expert auditor. Analyze the following business proposal documents against the provided rules.
      Extract key data points, identify potential risks based on the rules, and cite the context.
      Return ONLY a VALID JSON array of objects. Do not wrap in markdown code blocks.
      Format: [{"field": "...", "value": "...", "sourceContext": "...", "riskLevel": "Low/Medium/High"}]
      ${langInstruction}
  `;

  let text = "";

  if (provider === 'Gemini') {
      const parts = buildGeminiPromptParts(instruction, rules, docs);
      // Fix: Use contents: { parts: [...] } format and Type from @google/genai
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                field: { type: Type.STRING },
                value: { type: Type.STRING },
                sourceContext: { type: Type.STRING },
                riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
              },
              required: ["field", "value", "sourceContext", "riskLevel"]
            }
          }
        }
      });
      // Fix: Access .text property directly
      text = response.text || "[]";
  } else {
      // DeepSeek
      const messages = buildDeepSeekMessages(instruction, rules, docs);
      text = await callDeepSeek(messages);
  }

  // Cleanup for DeepSeek which might output markdown
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();

  if (!text) return [];
  try {
    return JSON.parse(text) as ExtractedInfo[];
  } catch (e) {
    console.error("Failed to parse extraction JSON", e);
    return [];
  }
};

export const generateSummary = async (docs: ReviewDocument[], language: Language, provider: ModelProvider = 'Gemini', customPrompt?: string): Promise<string> => {
  const isZh = language === 'zh';
  const langInstruction = isZh ? "Output the summary in Chinese (Simplified)." : "Output the summary in English.";
  
  // Refined instruction for structured, objective breakdown
  const structureInstruction = isZh 
    ? `请对提供的业务文档进行客观、高度结构化的执行摘要。摘要必须清晰列出以下五个板块，并使用 Markdown 标题或列表格式：
       1. **项目背景与目标**：明确阐述方案的起因、必要性及核心预期目标。
       2. **核心业务内容**：概括具体的方案执行内容、关键步骤、业务逻辑或技术路线。
       3. **主要干系人**：识别涉及的内部部门、外部合作方、客户或受益群体。
       4. **资源与财务概况**：提取预算金额、资金来源、人力投入、资产配置等核心数据。
       5. **实施计划与里程碑**：识别关键的时间节点、分阶段目标或预计实施周期。
       
       要求：
       - 保持客观中立，严禁使用任何主观臆断、夸张或赞美性的形容词（如“优秀的”、“卓越的”、“完美的”）。
       - 仅基于文档事实进行精炼总结。`
    : `Provide a highly structured, objective executive summary of the provided documents. You must separate the content into these five sections using Markdown headers or lists:
       1. **Background & Objective**: State the context and core intent of the proposal.
       2. **Core Content**: Summarize the key actions, steps, or business logic of the proposal.
       3. **Key Stakeholders**: Identify involved internal departments, external partners, or beneficiaries.
       4. **Resource & Financials**: Extract specific data on budgets, funding, staffing, or asset requirements.
       5. **Execution Timeline**: Identify key milestones, phases, or the overall project duration.
       
       Requirements:
       - Maintain a neutral, professional tone. Strictly avoid subjective praise or adjectives (e.g., "excellent", "pioneering", "perfect").
       - Base the summary purely on document facts.`;

  let userInstruction = "";
  if (customPrompt && customPrompt.trim()) {
    userInstruction = `\n[用户特定关注指令]: ${customPrompt.trim()}\n`;
  }

  const instruction = `
      ${structureInstruction}
      ${userInstruction}
      ${langInstruction}
  `;

  if (provider === 'Gemini') {
    const parts = buildGeminiPromptParts(instruction, [], docs);
    // Fix: Using contents: { parts: [...] } format. Removed maxOutputTokens to prevent blocking without thinkingBudget.
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: parts }
    });
    // Fix: Access .text property directly
    return response.text || "Could not generate summary.";
  } else {
    // DeepSeek
    const messages = buildDeepSeekMessages(instruction, [], docs);
    return await callDeepSeek(messages, 1500);
  }
};

export const draftReviewOpinion = async (
  docs: ReviewDocument[],
  rules: Rule[],
  extractedInfo: ExtractedInfo[],
  language: Language,
  provider: ModelProvider = 'Gemini'
): Promise<string> => {
  const extractionContext = JSON.stringify(extractedInfo);
  
  const langInstruction = language === 'zh' 
    ? "Write the review opinion in Chinese (Simplified). Use professional auditing terminology (e.g. 审查结论, 合规分析, 风险提示)." 
    : "Write the review opinion in English.";

  const instruction = `
      You are a senior compliance officer. Your task is to draft a formal "Review Opinion" (审查意见) for the proposed business scheme.
      
      1. Compare the proposal against the strict Local Rules provided below.
      2. Utilize the extracted risk points provided here: ${extractionContext}
      3. Your output must be a formal document structure including:
         - Review Conclusion (Pass / Reject / Conditional Pass)
         - Compliance Analysis (referencing specific rules)
         - Risk Warnings
         - Required Rectifications (if any)
      
      ${langInstruction}
  `;

  if (provider === 'Gemini') {
      const parts = buildGeminiPromptParts(instruction, rules, docs);
      // Gemini 3 Pro for thinking. Fix: Using contents: { parts: [...] } format and appropriate thinkingBudget.
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: parts },
        config: { thinkingConfig: { thinkingBudget: 32768 } }
      });
      // Fix: Access .text property directly
      return response.text || "Could not draft opinion.";
  } else {
      // DeepSeek (Use standard chat model, or deepseek-reasoner if available, but staying safe with V3 chat)
      const messages = buildDeepSeekMessages(instruction, rules, docs);
      return await callDeepSeek(messages, 2048);
  }
};
