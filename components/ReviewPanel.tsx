import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Rule, ReviewDocument, ExtractedInfo, Language, ModelProvider, ReviewSession, DocumentVersion, ReferenceDocument } from '../types';
import { extractKeyInformation, generateSummary, draftReviewOpinion } from '../services/geminiService';
import { DocumentSearchIcon, SparklesIcon, CheckCircleIcon, ExclamationIcon, UploadIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ArrowsPointingOutIcon, CpuChipIcon, PlusIcon, BookIcon, SaveIcon, ClockIcon, CameraIcon, ClipboardIcon } from './Icons';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Init PDF Worker
const initPdfWorker = () => {
  if (typeof window !== 'undefined' && pdfjsLib) {
    const lib = (pdfjsLib as any).default || pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }
};
initPdfWorker();

interface ReviewPanelProps {
  rules: Rule[];
  references: ReferenceDocument[];
  language: Language;
  modelProvider?: ModelProvider;
  sessions: ReviewSession[];
  onUpdateSession: (session: ReviewSession) => void;
  onDeleteSession: (id: string) => void;
}

const translations = {
  zh: {
    title: '审查工作台',
    subtitle: '上传材料并基于本地规则库进行智能分析',
    reset: '新建任务',
    newSessionTitle: '新审查任务',
    autoProcess: '一键智能分析',
    uploadTitle: '材料管理',
    docNamePlaceholder: '文件名...',
    docContentPlaceholder: '粘贴文本或上传文件...',
    addDoc: '添加材料',
    uploadBtn: '上传文件',
    uploading: '读取中...',
    includedDocs: '审查清单',
    noDocs: '暂无材料',
    step1: '1. 执行摘要',
    generateSummary: '生成摘要',
    generating: '分析中...',
    summaryNotReady: '摘要尚未生成。',
    summaryPromptPlaceholder: '输入关注点提示词（可选）...',
    step2: '2. 规则核查与提取',
    extractInfo: '提取信息',
    extracting: '提取中...',
    analyzing: '正在对比规则库进行审查...',
    noData: '尚未提取任何风险点。',
    tableHeaders: ['核心要素', '提取内容', '溯源上下文', '风险级别'],
    step3: '3. 审查意见拟定',
    draftOpinion: '拟定意见',
    drafting: '专家系统思考中...',
    opinionPlaceholder: '最终审查意见将在此生成。',
    risks: { Low: '低', Medium: '中', High: '高' },
    actions: {
        rename: '重命名',
        remove: '移除',
        save: '保存审查结果',
        saved: '保存成功',
        cancel: '取消',
        maximize: '全屏模式',
        close: '关闭',
        snapshot: '创建快照',
        history: '历史版本',
        revert: '还原此版本',
        copy: '复制内容',
        copied: '已复制'
    },
    confirmRevert: '确定还原到此快照吗？当前编辑的内容将被覆盖。'
  },
  en: {
    title: 'Review Workspace',
    subtitle: 'Analyze proposals against your local rules library.',
    reset: 'New Review',
    newSessionTitle: 'New Review Session',
    autoProcess: 'Auto-Process All',
    uploadTitle: 'Materials',
    docNamePlaceholder: 'Filename...',
    docContentPlaceholder: 'Paste text or upload file...',
    addDoc: 'Add Text',
    uploadBtn: 'Upload File',
    uploading: 'Loading...',
    includedDocs: 'Document List',
    noDocs: 'No documents.',
    step1: '1. Executive Summary',
    generateSummary: 'Summarize',
    generating: 'Analyzing...',
    summaryNotReady: 'Summary not generated yet.',
    summaryPromptPlaceholder: 'Enter custom focus (optional)...',
    step2: '2. Rule Check & Extraction',
    extractInfo: 'Extract',
    extracting: 'Extracting...',
    analyzing: 'Checking documents against rules...',
    noData: 'No risk data extracted yet.',
    tableHeaders: ['Element', 'Extracted Value', 'Context', 'Risk'],
    step3: '3. Draft Opinion',
    draftOpinion: 'Draft Opinion',
    drafting: 'Reasoning...',
    opinionPlaceholder: 'The formal review opinion will appear here.',
    risks: { Low: 'Low', Medium: 'Med', High: 'High' },
    actions: {
        rename: 'Rename',
        remove: 'Remove',
        save: 'Save Session',
        saved: 'Saved',
        cancel: 'Cancel',
        maximize: 'Full Screen',
        close: 'Close',
        snapshot: 'Snapshot',
        history: 'History',
        revert: 'Restore',
        copy: 'Copy',
        copied: 'Copied'
    },
    confirmRevert: 'Revert to this snapshot? Unsaved changes will be lost.'
  }
};

const createNewSession = (lang: Language): ReviewSession => ({
  id: Date.now().toString(),
  title: translations[lang].newSessionTitle || 'Untitled Review',
  status: 'Draft',
  documents: [],
  extractedData: [],
  summary: '',
  summaryPrompt: '',
  opinion: '',
  createdAt: Date.now()
});

const ReviewPanel: React.FC<ReviewPanelProps> = ({ rules, references, language, modelProvider = 'Gemini', sessions, onUpdateSession, onDeleteSession }) => {
  const t = translations[language];

  const [activeSession, setActiveSession] = useState<ReviewSession>(() => {
    return sessions.length > 0 ? JSON.parse(JSON.stringify(sessions[0])) : createNewSession(language);
  });

  const [maximizedSection, setMaximizedSection] = useState<'summary' | 'extraction' | 'opinion' | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [docInput, setDocInput] = useState('');
  const [docName, setDocName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard accessibility: ESC to close full screen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximizedSection(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const isDirty = useMemo(() => {
    const original = sessions.find(s => s.id === activeSession.id);
    if (!original) return true;
    return JSON.stringify(original) !== JSON.stringify(activeSession);
  }, [activeSession, sessions]);

  const handleSaveSession = () => {
    setIsSaving(true);
    onUpdateSession(activeSession);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleNewSession = () => {
    setActiveSession(createNewSession(language));
    setHistoryDocId(null);
  };

  const handleSelectSession = (s: ReviewSession) => {
    setActiveSession(JSON.parse(JSON.stringify(s)));
    setHistoryDocId(null);
  };

  const handleAddTextDocument = () => {
    if (!docInput || !docName) return;
    const newDoc: ReviewDocument = {
      id: Date.now().toString(),
      name: docName,
      content: docInput,
      type: 'txt',
      mimeType: 'text/plain',
      versions: []
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
    const fileType = file.name.split('.').pop()?.toLowerCase();
    try {
      let newDoc: ReviewDocument | null = null;
      if (fileType === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const base64Content = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        let extractedText = "";
        try {
          const lib = (pdfjsLib as any).default || pdfjsLib;
          const pdf = await lib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
             const page = await pdf.getPage(i);
             const textContent = await page.getTextContent();
             extractedText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
          }
        } catch (e) { 
          console.warn("Text extraction failed", e); 
        }
        newDoc = { id: Date.now().toString(), name: file.name, content: base64Content, extractedText, type: 'pdf', mimeType: 'application/pdf', versions: [] };
      } else if (fileType === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const mm = (mammoth as any).default || mammoth;
        const result = await mm.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
        newDoc = { id: Date.now().toString(), name: file.name, content: result.value, extractedText: result.value, type: 'docx', mimeType: 'text/plain', versions: [] };
      } else {
        const content = await file.text();
        newDoc = { id: Date.now().toString(), name: file.name, content, extractedText: content, type: 'txt', mimeType: 'text/plain', versions: [] };
      }
      if (newDoc) setActiveSession(prev => ({ ...prev, documents: [...prev.documents, newDoc!], title: prev.documents.length === 0 ? newDoc!.name : prev.title }));
    } catch (error) { 
        console.error("FileUpload error", error);
        alert("Parser Error: " + error); 
    }
    finally { setIsUploading(false); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyToClipboard = (content: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
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
    }
  };

  const removeDocument = (id: string) => {
    setActiveSession(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== id)
    }));
  };

  const handleTakeSnapshot = (doc: ReviewDocument) => {
    const snapshot: DocumentVersion = { id: Date.now().toString(), timestamp: Date.now(), name: doc.name, content: doc.content, extractedText: doc.extractedText };
    setActiveSession(prev => ({
      ...prev,
      documents: prev.documents.map(d => d.id === doc.id ? { ...d, versions: [snapshot, ...(d.versions || [])] } : d)
    }));
  };

  const handleRevert = (docId: string, version: DocumentVersion) => {
    if (!confirm(t.confirmRevert)) return;
    setActiveSession(prev => ({
      ...prev,
      documents: prev.documents.map(d => d.id === docId ? { ...d, name: version.name, content: version.content, extractedText: version.extractedText } : d)
    }));
    setHistoryDocId(null);
  };

  const runExtraction = async (): Promise<ExtractedInfo[]> => {
    if (activeSession.documents.length === 0) return [];
    setIsExtracting(true);
    try {
      const data = await extractKeyInformation(activeSession.documents, rules, language, modelProvider as ModelProvider, references);
      setActiveSession(prev => ({ ...prev, extractedData: data }));
      return data;
    } finally { setIsExtracting(false); }
  };

  const runSummary = async (): Promise<string> => {
    if (activeSession.documents.length === 0) return "";
    setIsSummarizing(true);
    try {
      const text = await generateSummary(activeSession.documents, language, modelProvider as ModelProvider, activeSession.summaryPrompt);
      setActiveSession(prev => ({ ...prev, summary: text }));
      return text;
    } finally { setIsSummarizing(false); }
  };

  const runOpinion = async (overrideData?: ExtractedInfo[]): Promise<string> => {
    const dataToUse = overrideData || activeSession.extractedData;
    if (activeSession.documents.length === 0 || dataToUse.length === 0) return "";
    setIsDrafting(true);
    try {
      const text = await draftReviewOpinion(activeSession.documents, rules, dataToUse, language, modelProvider as ModelProvider);
      setActiveSession(prev => ({ ...prev, opinion: text, status: 'Completed' }));
      return text;
    } finally { setIsDrafting(false); }
  };

  const runAll = async () => {
    if (activeSession.documents.length === 0) return;
    await runSummary();
    const data = await runExtraction();
    if (data && data.length > 0) {
      await runOpinion(data);
    }
  };

  const renderSummaryContent = (isMax = false) => (
    <div className={`text-slate-700 leading-relaxed ${isMax ? 'text-xl p-8 max-w-4xl mx-auto' : 'text-sm min-h-[100px]'}`}>
      {isSummarizing ? (
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-slate-200 rounded-full w-full"></div>
          <div className="h-3 bg-slate-200 rounded-full w-5/6"></div>
          <div className="h-3 bg-slate-200 rounded-full w-4/5"></div>
        </div>
      ) : activeSession.summary ? (
        <div className="prose prose-slate max-w-none prose-lg">
          <ReactMarkdown>{activeSession.summary}</ReactMarkdown>
        </div>
      ) : (
        <span className="italic text-slate-400">{t.summaryNotReady}</span>
      )}
    </div>
  );

  const renderExtractionContent = (isMax = false) => (
    <div className={`overflow-x-auto ${isMax ? 'p-8' : ''}`}>
      {activeSession.extractedData.length > 0 ? (
        <table className={`w-full text-left border-collapse ${isMax ? 'text-lg' : 'text-sm'}`}>
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{t.tableHeaders.map((h, i) => <th key={i} className={`p-4 font-black text-slate-500 uppercase tracking-widest ${isMax ? 'text-xs' : 'text-[10px]'}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeSession.extractedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                <td className="p-4 font-bold text-slate-800">{row.field}</td>
                <td className="p-4 text-slate-700">{row.value}</td>
                <td className={`p-4 italic text-slate-500 font-medium ${isMax ? 'text-sm' : 'text-xs'}`}>"{row.sourceContext}"</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm ${
                    row.riskLevel === 'High' ? 'bg-red-100 text-red-700' : row.riskLevel === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {row.riskLevel === 'Low' ? t.risks.Low : row.riskLevel === 'Medium' ? t.risks.Medium : t.risks.High}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="p-20 text-center text-slate-400 italic text-sm">{isExtracting ? t.analyzing : t.noData}</div>}
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 gap-6 overflow-hidden relative">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-700 text-xs flex items-center gap-2 tracking-widest uppercase"><ClockIcon /> {t.actions.history}</h3>
              <button onClick={handleNewSession} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><PlusIcon /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(s => (
                  <div key={s.id} onClick={() => handleSelectSession(s)} className={`group p-4 rounded-2xl cursor-pointer transition-all ${activeSession.id === s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-slate-100'}`}>
                      <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-black truncate flex-1 tracking-tight">{s.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); if(activeSession.id === s.id) handleNewSession(); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500 hover:text-white transition-all"><TrashIcon /></button>
                      </div>
                      <div className="flex justify-between text-[9px] font-black opacity-70 uppercase tracking-widest mt-2">
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                        <span>{s.status}</span>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-2">
        <div className="bg-white p-5 mb-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tighter"><DocumentSearchIcon /> {activeSession.title}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
               <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200">
                  <CpuChipIcon />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{modelProvider} Engine</span>
               </div>
               <button onClick={handleSaveSession} disabled={!isDirty || isSaving} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border shadow-sm ${
                  !isDirty ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-default' : isSaving ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                }`}>
                {isSaving ? <CheckIcon /> : <SaveIcon />}
                {isSaving ? t.actions.saved : t.actions.save}
              </button>
              <button onClick={runAll} disabled={activeSession.documents.length === 0 || isExtracting || isSummarizing || isDrafting} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.1em] shadow-2xl shadow-slate-300 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-30">
                <SparklesIcon /> {t.autoProcess}
              </button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden pb-4">
          <div className="w-1/3 flex flex-col gap-5 overflow-hidden">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex-shrink-0">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.uploadTitle}</h3>
                <div className="mb-5 p-8 border-2 border-dashed border-slate-100 rounded-[1.5rem] bg-slate-50/50 flex flex-col items-center justify-center text-center group hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.docx,.txt" className="hidden" />
                   <div className="p-3 bg-white rounded-xl shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      {isUploading ? <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex"></span> : <UploadIcon />}
                   </div>
                   <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{t.uploadBtn}</span>
                </div>
                <div className="space-y-3">
                    <input className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder={t.docNamePlaceholder} value={docName} onChange={e => setDocName(e.target.value)} />
                    <textarea className="w-full h-24 p-3 text-xs border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 resize-none transition-all" placeholder={t.docContentPlaceholder} value={docInput} onChange={e => setDocInput(e.target.value)} />
                    <button onClick={handleAddTextDocument} disabled={!docName || !docInput} className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-20 transition-all">{t.addDoc}</button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex-1 overflow-auto">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                    {t.includedDocs} 
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">({activeSession.documents.length})</span>
                </h3>
                <div className="space-y-3">
                  {activeSession.documents.map(doc => (
                    <div key={doc.id} className="border border-slate-100 bg-slate-50/50 rounded-2xl overflow-hidden group">
                      <div className="p-4">
                        <div className="flex justify-between items-center">
                          {editingDocId === doc.id ? (
                            <div className="flex items-center gap-2 w-full">
                                <input type="text" className="flex-1 text-xs border border-blue-400 rounded-xl px-3 py-2 outline-none" value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && saveRename()} />
                                <button onClick={saveRename} className="text-green-600 bg-green-50 p-2 rounded-lg"><CheckIcon /></button>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-1 truncate flex-1">
                                 <span className="font-black text-slate-700 text-xs truncate tracking-tight">{doc.name}</span>
                                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{doc.type} • {doc.mimeType}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => handleTakeSnapshot(doc)} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-all" title={t.actions.snapshot}><CameraIcon /></button>
                                 <button onClick={() => setHistoryDocId(historyDocId === doc.id ? null : doc.id)} className={`p-2 rounded-lg transition-all ${historyDocId === doc.id ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}><ClockIcon /></button>
                                 <button onClick={() => startEditing(doc)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-all"><PencilIcon /></button>
                                 <button onClick={() => removeDocument(doc.id)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"><TrashIcon /></button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {historyDocId === doc.id && (
                        <div className="bg-white border-t border-slate-100 p-4 space-y-2">
                          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t.actions.history}</h4>
                          {doc.versions?.length ? doc.versions.map(v => (
                            <div key={v.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100">
                              <span className="text-[10px] font-black text-slate-500">{new Date(v.timestamp).toLocaleString()}</span>
                              <button onClick={() => handleRevert(doc.id, v)} className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-tighter">{t.actions.revert}</button>
                            </div>
                          )) : <p className="text-[9px] text-slate-300 italic">No snapshots found.</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
          </div>

          <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-10 custom-scrollbar">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
               <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.step1}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMaximizedSection('summary')} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title={t.actions.maximize}><ArrowsPointingOutIcon /></button>
                      <button onClick={runSummary} disabled={isSummarizing || activeSession.documents.length === 0} className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95 disabled:opacity-30">
                        {isSummarizing ? t.generating : t.generateSummary}
                      </button>
                  </div>
               </div>
               <div className="p-6 flex flex-col gap-4">
                  <textarea className="w-full text-xs p-4 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100/50 resize-none bg-slate-50/30 transition-all" rows={2} placeholder={t.summaryPromptPlaceholder} value={activeSession.summaryPrompt} onChange={e => setActiveSession(prev => ({ ...prev, summaryPrompt: e.target.value }))} />
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    {renderSummaryContent()}
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
               <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.step2}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMaximizedSection('extraction')} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title={t.actions.maximize}><ArrowsPointingOutIcon /></button>
                      <button onClick={runExtraction} disabled={isExtracting || activeSession.documents.length === 0} className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95 disabled:opacity-30">
                        {isExtracting ? t.extracting : t.extractInfo}
                      </button>
                  </div>
               </div>
               {renderExtractionContent()}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
               <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.step3}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMaximizedSection('opinion')} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title={t.actions.maximize}><ArrowsPointingOutIcon /></button>
                      <button onClick={() => runOpinion()} disabled={isDrafting || activeSession.extractedData.length === 0} className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-30">
                        {isDrafting ? t.drafting : t.draftOpinion}
                      </button>
                  </div>
               </div>
               <div className="p-8">
                {isDrafting ? <div className="animate-pulse space-y-4"><div className="h-3 bg-slate-200 rounded-full w-1/4"></div><div className="h-3 bg-slate-200 rounded-full w-3/4"></div><div className="h-3 bg-slate-200 rounded-full w-full"></div><div className="h-3 bg-slate-200 rounded-full w-5/6"></div></div>
                : activeSession.opinion ? <div className="prose prose-blue max-w-none text-slate-800 font-medium leading-relaxed"><ReactMarkdown>{activeSession.opinion}</ReactMarkdown></div> : <div className="text-center text-slate-300 italic py-16 font-black uppercase tracking-widest text-[10px]">{t.opinionPlaceholder}</div>}
               </div>
            </div>
          </div>
        </div>
      </div>

      {maximizedSection && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in zoom-in-95 duration-300 shadow-2xl">
           <div className="px-10 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-xl flex justify-between items-center sticky top-0 z-30">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-600 text-white p-3.5 rounded-2xl shadow-xl shadow-blue-100 animate-pulse"><ArrowsPointingOutIcon className="w-6 h-6" /></div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
                        {maximizedSection === 'summary' && t.step1}
                        {maximizedSection === 'extraction' && t.step2}
                        {maximizedSection === 'opinion' && t.step3}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Focus Mode • {activeSession.title}</p>
                 </div>
              </div>
              
              <div className="flex items-center gap-4">
                 {(maximizedSection === 'summary' || maximizedSection === 'opinion') && (
                   <button 
                    onClick={() => handleCopyToClipboard(maximizedSection === 'summary' ? activeSession.summary : activeSession.opinion)} 
                    className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest border rounded-2xl transition-all shadow-sm ${isCopied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                   >
                     {isCopied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                     {isCopied ? t.actions.copied : t.actions.copy}
                   </button>
                 )}
                 <button onClick={() => setMaximizedSection(null)} className="flex items-center gap-2 px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-white bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 shadow-xl transition-all"><XMarkIcon className="w-5 h-5" /> {t.actions.close}</button>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto bg-slate-50/30 p-12 lg:p-24 custom-scrollbar">
              <div className={`mx-auto bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden ${maximizedSection === 'extraction' ? 'max-w-7xl' : 'max-w-5xl'}`}>
                 {maximizedSection === 'summary' && (
                    <div className="p-16 animate-in slide-in-from-bottom-8 duration-700">
                        {renderSummaryContent(true)}
                    </div>
                 )}
                 {maximizedSection === 'extraction' && (
                    <div className="animate-in slide-in-from-bottom-8 duration-700">
                        {renderExtractionContent(true)}
                    </div>
                 )}
                 {maximizedSection === 'opinion' && (
                    <div className="p-20 animate-in slide-in-from-bottom-8 duration-700 prose prose-2xl max-w-none text-slate-800 font-medium leading-[2.2]">
                        <ReactMarkdown>{activeSession.opinion}</ReactMarkdown>
                    </div>
                 )}
              </div>
              <div className="h-20" /> {/* Extra space at bottom */}
           </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;