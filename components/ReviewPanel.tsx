
import React, { useState, useRef, useEffect } from 'react';
import { Rule, ReviewDocument, ExtractedInfo, Language, ModelProvider, ReviewSession } from '../types';
import { extractKeyInformation, generateSummary, draftReviewOpinion } from '../services/geminiService';
import { DocumentSearchIcon, SparklesIcon, CheckCircleIcon, ExclamationIcon, UploadIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ArrowsPointingOutIcon, CpuChipIcon, PlusIcon, BookIcon } from './Icons';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Init PDF Worker similar to RuleBase
const initPdfWorker = () => {
  if (typeof window !== 'undefined' && pdfjsLib) {
    // Fix: Handle PDF.js import differences by casting to any to access potential default property
    const lib = (pdfjsLib as any).default || pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }
};
initPdfWorker();

interface ReviewPanelProps {
  rules: Rule[];
  language: Language;
  modelProvider?: ModelProvider;
  sessions: ReviewSession[];
  onUpdateSession: (session: ReviewSession) => void;
  onDeleteSession: (id: string) => void;
}

const translations = {
  zh: {
    title: '审查工作台',
    subtitle: '上传业务方案材料，AI 助手将根据本地规则进行分析',
    reset: '新建审查',
    autoProcess: '一键智能分析',
    uploadTitle: '上传材料',
    docNamePlaceholder: '文档名称 (如：项目范围说明书.txt)',
    docContentPlaceholder: '在此粘贴文档内容，或上传 PDF/DOCX 文件...',
    addDoc: '添加文本',
    uploadBtn: '上传文件',
    uploading: '读取中...',
    includedDocs: '已包含材料',
    noDocs: '暂无文档',
    step1: '1. 执行摘要',
    generateSummary: '生成摘要',
    generating: '生成中...',
    summaryNotReady: '摘要尚未生成。',
    summaryPromptPlaceholder: '在此输入自定义提示词（可选），例如：重点关注财务预算...',
    step2: '2. 关键信息与风险核查',
    extractInfo: '提取信息',
    extracting: '提取中...',
    analyzing: '正在根据本地规则分析文档...',
    noData: '暂无提取数据。',
    tableHeaders: ['数据点', '提取值', '合规备注', '风险等级'],
    step3: '3. 拟定审查意见',
    draftOpinion: '拟定意见',
    drafting: '思考与撰写中...',
    opinionPlaceholder: '基于规则和提取风险生成的审查意见将显示在这里。',
    risks: {
      Low: '低',
      Medium: '中',
      High: '高'
    },
    alertExtractFirst: '请先提取信息。',
    alertExtractFail: '提取信息失败。',
    uploadSupported: '支持 .pdf, .docx, .txt',
    actions: {
        rename: '重命名',
        remove: '移除',
        save: '保存',
        cancel: '取消',
        maximize: '全屏查看',
        close: '关闭'
    },
    currentModel: '当前模型',
    history: '历史审查记录',
    noHistory: '暂无历史记录',
    activeSession: '正在审查',
    newSessionTitle: '未命名审查',
    regeneration: '重新生成',
    saveSuccess: '审查结果已保存'
  },
  en: {
    title: 'Review Workspace',
    subtitle: 'Upload proposal materials and let the AI assistant analyze them against your rules.',
    reset: 'New Review',
    autoProcess: 'Auto-Process All',
    uploadTitle: 'Upload Materials',
    docNamePlaceholder: 'Document Name (e.g., Project Scope.txt)',
    docContentPlaceholder: 'Paste document content here or upload PDF/DOCX...',
    addDoc: 'Add Text',
    uploadBtn: 'Upload File',
    uploading: 'Reading...',
    includedDocs: 'Included Materials',
    noDocs: 'No documents added yet.',
    step1: '1. Executive Summary',
    generateSummary: 'Generate Summary',
    generating: 'Generating...',
    summaryNotReady: 'Summary not generated yet.',
    summaryPromptPlaceholder: 'Enter custom prompt (optional), e.g., Focus on budget...',
    step2: '2. Key Information & Risk Check',
    extractInfo: 'Extract Info',
    extracting: 'Extracting...',
    analyzing: 'Analyzing documents against local rules...',
    noData: 'No data extracted yet.',
    tableHeaders: ['Data Point', 'Extracted Value', 'Compliance Note', 'Risk'],
    step3: '3. Draft Review Opinion',
    draftOpinion: 'Draft Opinion',
    drafting: 'Thinking & Drafting...',
    opinionPlaceholder: 'Generated opinion based on rules and extracted risks will appear here.',
    risks: {
      Low: 'Low',
      Medium: 'Med',
      High: 'High'
    },
    alertExtractFirst: 'Please extract information first.',
    alertExtractFail: 'Failed to extract information.',
    uploadSupported: 'Supports .pdf, .docx, .txt',
    actions: {
        rename: 'Rename',
        remove: 'Remove',
        save: 'Save',
        cancel: 'Cancel',
        maximize: 'Full Screen',
        close: 'Close'
    },
    currentModel: 'Model',
    history: 'Review History',
    noHistory: 'No history found',
    activeSession: 'Current Review',
    newSessionTitle: 'Untitled Review',
    regeneration: 'Regenerate',
    saveSuccess: 'Review results saved'
  }
};

const createNewSession = (lang: Language): ReviewSession => ({
  id: Date.now().toString(),
  title: translations[lang].newSessionTitle,
  status: 'Draft',
  documents: [],
  extractedData: [],
  summary: '',
  summaryPrompt: '',
  opinion: '',
  createdAt: Date.now()
});

const ReviewPanel: React.FC<ReviewPanelProps> = ({ rules, language, modelProvider = 'Gemini', sessions, onUpdateSession, onDeleteSession }) => {
  const t = translations[language];

  // Active Session State
  const [activeSession, setActiveSession] = useState<ReviewSession>(() => {
    return sessions.length > 0 ? sessions[0] : createNewSession(language);
  });

  const [maximizedSection, setMaximizedSection] = useState<'summary' | 'extraction' | 'opinion' | null>(null);
  
  // Edit State for Docs
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Loading States
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Input Temp States
  const [docInput, setDocInput] = useState('');
  const [docName, setDocName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync session changes back to App.tsx
  useEffect(() => {
    onUpdateSession(activeSession);
  }, [activeSession]);

  const handleNewSession = () => {
    setActiveSession(createNewSession(language));
  };

  const handleSelectSession = (s: ReviewSession) => {
    setActiveSession(s);
  };

  const handleAddTextDocument = () => {
    if (!docInput || !docName) return;
    const newDoc: ReviewDocument = {
      id: Date.now().toString(),
      name: docName,
      content: docInput,
      type: 'txt',
      mimeType: 'text/plain'
    };
    setActiveSession(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc],
      title: prev.documents.length === 0 ? newDoc.name : prev.title
    }));
    setDocInput('');
    setDocName('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name;
    const fileType = file.name.split('.').pop()?.toLowerCase();

    try {
      let newDoc: ReviewDocument | null = null;

      if (fileType === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const base64Content = btoa(
          new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        let extractedText = "";
        try {
          // Fix: Handle PDF lib import differences by casting to any to access potential default property
          const lib = (pdfjsLib as any).default || pdfjsLib;
          const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
             const page = await pdf.getPage(i);
             const textContent = await page.getTextContent();
             extractedText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
          }
        } catch (e) {
           console.warn("Could not extract text from PDF for DeepSeek fallback", e);
        }

        newDoc = {
          id: Date.now().toString(),
          name: fileName,
          content: base64Content,
          extractedText: extractedText,
          type: 'pdf',
          mimeType: 'application/pdf'
        };
      } else if (fileType === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        newDoc = {
          id: Date.now().toString(),
          name: fileName,
          content: result.value,
          type: 'docx',
          mimeType: 'text/plain'
        };
      } else {
        const textContent = await file.text();
        newDoc = {
          id: Date.now().toString(),
          name: fileName,
          content: textContent,
          type: 'txt',
          mimeType: 'text/plain'
        };
      }

      if (newDoc) {
        setActiveSession(prev => ({
          ...prev,
          documents: [...prev.documents, newDoc!],
          title: prev.documents.length === 0 ? newDoc!.name : prev.title
        }));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to parse file.");
    } finally {
      setIsUploading(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEditing = (doc: ReviewDocument) => {
    setEditingDocId(doc.id);
    setEditName(doc.name);
  };

  const saveRename = () => {
    if (editingDocId && editName.trim()) {
      setActiveSession(prev => ({
        ...prev,
        documents: prev.documents.map(d => d.id === editingDocId ? { ...d, name: editName.trim() } : d)
      }));
      setEditingDocId(null);
      setEditName('');
    }
  };

  const removeDocument = (id: string) => {
    setActiveSession(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== id)
    }));
  };

  // Analysis Actions
  const runExtraction = async () => {
    if (activeSession.documents.length === 0) return;
    setIsExtracting(true);
    try {
      const data = await extractKeyInformation(activeSession.documents, rules, language, modelProvider as ModelProvider);
      setActiveSession(prev => ({ ...prev, extractedData: data }));
    } catch (error) {
      console.error(error);
      alert(t.alertExtractFail);
    } finally {
      setIsExtracting(false);
    }
  };

  const runSummary = async () => {
    if (activeSession.documents.length === 0) return;
    setIsSummarizing(true);
    try {
      const text = await generateSummary(activeSession.documents, language, modelProvider as ModelProvider, activeSession.summaryPrompt);
      setActiveSession(prev => ({ ...prev, summary: text }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const runOpinion = async () => {
    if (activeSession.documents.length === 0 || activeSession.extractedData.length === 0) {
      alert(t.alertExtractFirst);
      return;
    }
    setIsDrafting(true);
    try {
      const text = await draftReviewOpinion(activeSession.documents, rules, activeSession.extractedData, language, modelProvider as ModelProvider);
      setActiveSession(prev => ({ ...prev, opinion: text, status: 'Completed' }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsDrafting(false);
    }
  };

  const runAll = async () => {
    await runExtraction();
    await runSummary();
  };

  // Render Helpers
  const renderSummaryContent = (isMaximized = false) => (
    <div className={`text-sm text-slate-700 leading-relaxed ${isMaximized ? 'text-base p-2' : 'min-h-[100px]'}`}>
      {isSummarizing ? (
         <div className="animate-pulse flex space-x-4">
           <div className="flex-1 space-y-4 py-1">
             <div className="h-2 bg-slate-200 rounded"></div>
             <div className="h-2 bg-slate-200 rounded w-5/6"></div>
             <div className="h-2 bg-slate-200 rounded w-4/6"></div>
           </div>
         </div>
      ) : activeSession.summary ? (
        <ReactMarkdown>{activeSession.summary}</ReactMarkdown>
      ) : (
        <span className="text-slate-400 italic">{t.summaryNotReady}</span>
      )}
    </div>
  );

  const renderExtractionContent = (isMaximized = false) => (
    <div className="overflow-x-auto">
      {activeSession.extractedData.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100 sticky top-0">
            <tr>
              {t.tableHeaders.map((header, i) => (
                  <th key={i} className={`p-3 ${i===3 && !isMaximized ? 'w-[100px]' : 'w-1/4'}`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeSession.extractedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-700">{row.field}</td>
                <td className="p-3 text-slate-600">{row.value}</td>
                <td className="p-3 text-xs text-slate-500 italic">"{row.sourceContext}"</td>
                <td className="p-3">
                    {row.riskLevel === 'Low' && <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full"><CheckCircleIcon /> {t.risks.Low}</span>}
                    {row.riskLevel === 'Medium' && <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full"><ExclamationIcon /> {t.risks.Medium}</span>}
                    {row.riskLevel === 'High' && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full"><ExclamationIcon /> {t.risks.High}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="p-5 text-center text-slate-400 text-sm italic">
          {isExtracting ? t.analyzing : t.noData}
        </div>
      )}
    </div>
  );

  const renderOpinionContent = (isMaximized = false) => (
    <div className={`bg-white ${isMaximized ? 'text-base p-2' : 'min-h-[200px]'}`}>
      {isDrafting ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          </div>
      ) : activeSession.opinion ? (
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown>{activeSession.opinion}</ReactMarkdown>
        </div>
      ) : (
        <div className="text-center text-slate-400 text-sm italic pt-10">
            {t.opinionPlaceholder}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 gap-6 overflow-hidden relative">
      
      {/* Session History Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><BookIcon /> {t.history}</h3>
              <button onClick={handleNewSession} className="p-1 hover:bg-blue-50 text-blue-600 rounded-md" title={t.reset}>
                  <PlusIcon />
              </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 && <p className="text-xs text-slate-400 p-4 text-center">{t.noHistory}</p>}
              {sessions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => handleSelectSession(s)}
                    className={`group p-3 rounded-lg cursor-pointer flex flex-col gap-1 transition-all ${activeSession.id === s.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-100'}`}
                  >
                      <div className="flex justify-between items-start">
                          <span className="text-sm font-medium truncate flex-1 pr-2">{s.title}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); if (activeSession.id === s.id) handleNewSession(); }}
                            className={`opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500 hover:text-white transition-all ${activeSession.id === s.id ? 'text-blue-200' : 'text-slate-400'}`}
                          >
                             <TrashIcon />
                          </button>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                          <span className={activeSession.id === s.id ? 'text-blue-100' : 'text-slate-400'}>{new Date(s.createdAt).toLocaleDateString()}</span>
                          <span className={`px-1.5 py-0.5 rounded-full ${s.status === 'Completed' ? (activeSession.id === s.id ? 'bg-blue-500 text-white border border-blue-400' : 'bg-green-100 text-green-700') : (activeSession.id === s.id ? 'bg-blue-500 text-white opacity-60' : 'bg-slate-100 text-slate-500')}`}>
                              {s.status}
                          </span>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white p-4 mb-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <DocumentSearchIcon /> {activeSession.title}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
               <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                  <CpuChipIcon />
                  <span className="text-xs font-semibold text-slate-600">{modelProvider}</span>
               </div>
              <button 
                onClick={runAll}
                disabled={activeSession.documents.length === 0 || isExtracting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <SparklesIcon /> {t.autoProcess}
              </button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Left Column: Inputs & Documents */}
          <div className="w-1/3 flex flex-col gap-4 overflow-hidden">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-shrink-0">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">{t.uploadTitle}</h3>
                <div className="mb-4 p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 flex flex-col items-center justify-center text-center">
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.docx,.txt" className="hidden" />
                   <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="mb-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 flex items-center gap-2 shadow-sm">
                      {isUploading ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span> : <UploadIcon />}
                      {isUploading ? t.uploading : t.uploadBtn}
                   </button>
                   <p className="text-xs text-slate-400">{t.uploadSupported}</p>
                </div>
                <div className="border-t border-slate-100 my-2"></div>
                <input className="w-full mb-2 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t.docNamePlaceholder} value={docName} onChange={e => setDocName(e.target.value)} />
                <textarea className="w-full h-24 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-2" placeholder={t.docContentPlaceholder} value={docInput} onChange={e => setDocInput(e.target.value)} />
                <button onClick={handleAddTextDocument} disabled={!docName || !docInput} className="w-full bg-slate-800 text-white py-2 rounded text-sm font-medium hover:bg-slate-700 disabled:opacity-50">{t.addDoc}</button>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 overflow-auto">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">{t.includedDocs} ({activeSession.documents.length})</h3>
                <div className="space-y-2">
                  {activeSession.documents.length === 0 && <p className="text-xs text-slate-400 italic">{t.noDocs}</p>}
                  {activeSession.documents.map((doc) => (
                    <div key={doc.id} className="p-3 border border-slate-100 bg-slate-50 rounded group">
                      <div className="flex justify-between items-center mb-1">
                        {editingDocId === doc.id ? (
                          <div className="flex items-center gap-2 w-full">
                              <input type="text" className="flex-1 text-sm border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-500" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' ? saveRename() : e.key === 'Escape' && setEditingDocId(null)} />
                              <button onClick={saveRename} className="text-green-600 hover:text-green-800"><CheckIcon /></button>
                              <button onClick={() => setEditingDocId(null)} className="text-red-500 hover:text-red-700"><XMarkIcon /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                               <span className="font-medium text-slate-700 text-sm truncate" title={doc.name}>{doc.name}</span>
                               <span className={`text-[10px] uppercase border px-1 rounded flex-shrink-0 ${doc.type === 'pdf' ? 'text-red-600 border-red-200 bg-red-50' : doc.type === 'docx' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-slate-500 border-slate-200'}`}>{doc.type}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => startEditing(doc)} className="text-slate-400 hover:text-blue-600 p-1"><PencilIcon /></button>
                               <button onClick={() => removeDocument(doc.id)} className="text-slate-400 hover:text-red-600 p-1"><TrashIcon /></button>
                            </div>
                          </>
                        )}
                      </div>
                      {editingDocId !== doc.id && <p className="text-xs text-slate-500 line-clamp-1">{doc.type === 'pdf' ? '(PDF Ready)' : doc.content}</p>}
                    </div>
                  ))}
                </div>
              </div>
          </div>

          {/* Center Column: Analysis Results */}
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-10">
            {/* Step 1: Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700">{t.step1}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMaximizedSection('summary')} className="text-slate-400 hover:text-blue-600"><ArrowsPointingOutIcon /></button>
                      <button onClick={runSummary} disabled={isSummarizing || activeSession.documents.length === 0} className="text-xs bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-50 disabled:opacity-50">
                      {isSummarizing ? t.generating : (activeSession.summary ? t.regeneration : t.generateSummary)}
                      </button>
                  </div>
               </div>
               <div className="p-5 flex flex-col gap-3">
                  <textarea className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-slate-50 placeholder-slate-400 text-slate-700" rows={2} placeholder={t.summaryPromptPlaceholder} value={activeSession.summaryPrompt} onChange={(e) => setActiveSession(prev => ({ ...prev, summaryPrompt: e.target.value }))} />
                  {renderSummaryContent()}
               </div>
            </div>

            {/* Step 2: Extraction Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700">{t.step2}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMaximizedSection('extraction')} className="text-slate-400 hover:text-blue-600"><ArrowsPointingOutIcon /></button>
                      <button onClick={runExtraction} disabled={isExtracting || activeSession.documents.length === 0} className="text-xs bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-50 disabled:opacity-50">
                      {isExtracting ? t.extracting : (activeSession.extractedData.length > 0 ? t.regeneration : t.extractInfo)}
                      </button>
                  </div>
               </div>
               {renderExtractionContent()}
            </div>

            {/* Step 3: Opinion Draft */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700">{t.step3}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMaximizedSection('opinion')} className="text-slate-400 hover:text-blue-600"><ArrowsPointingOutIcon /></button>
                      <button onClick={runOpinion} disabled={isDrafting || activeSession.extractedData.length === 0} className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-100 disabled:opacity-50">
                      {isDrafting ? t.drafting : (activeSession.opinion ? t.regeneration : t.draftOpinion)}
                      </button>
                  </div>
               </div>
               <div className="p-6">{renderOpinionContent()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      {maximizedSection && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in zoom-in-95 duration-200">
           <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800">
                {maximizedSection === 'summary' && t.step1}
                {maximizedSection === 'extraction' && t.step2}
                {maximizedSection === 'opinion' && t.step3}
              </h2>
              <button onClick={() => setMaximizedSection(null)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"><XMarkIcon /> {t.actions.close}</button>
           </div>
           <div className="flex-1 overflow-auto bg-white p-8">
              <div className={`mx-auto ${maximizedSection === 'extraction' ? 'max-w-full' : 'max-w-5xl'}`}>
                 {maximizedSection === 'summary' && renderSummaryContent(true)}
                 {maximizedSection === 'extraction' && renderExtractionContent(true)}
                 {maximizedSection === 'opinion' && renderOpinionContent(true)}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;
