
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Rule, Language, ReferenceDocument, ModelProvider } from '../types';
import { PlusIcon, TrashIcon, BookIcon, UploadIcon, EyeIcon, XMarkIcon, AcademicCapIcon, BeakerIcon, BoltIcon, SparklesIcon, CheckIcon, DocumentSearchIcon, PhotoIcon, PencilIcon, SaveIcon, NewspaperIcon, ExclamationIcon, InformationCircleIcon, ClipboardIcon } from './Icons';
import { queryKnowledgeBase, performOCR, categorizeText, extractKeywords, matchBooleanQuery } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

const initPdfWorker = () => {
  if (typeof window !== 'undefined' && pdfjsLib) {
    const lib = (pdfjsLib as any).default || pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }
};
initPdfWorker();

interface RuleBaseProps {
  rules: Rule[];
  setRules: React.Dispatch<React.SetStateAction<Rule[]>>;
  references: ReferenceDocument[];
  setReferences: React.Dispatch<React.SetStateAction<ReferenceDocument[]>>;
  language: Language;
  modelProvider?: ModelProvider;
}

interface ProcessingFile {
  id: string;
  name: string;
  status: 'processing' | 'completed' | 'error';
  error?: string;
}

const translations = {
  zh: {
    title: '知识库与训练',
    subtitle: '极速检索与多模态制度解析系统',
    tabRules: '审查规则库',
    tabRefs: '制度参考库',
    tabLab: '知识问答中心',
    addRule: '录入审查规则',
    addRef: '导入参考制度',
    inputTitle: '标题',
    inputContent: '输入正文...',
    category: '分类',
    status: '状态',
    actions: '操作',
    edit: '编辑',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    empty: '暂无内容',
    searchPlaceholder: '检索 (支持 AND, OR, NOT)...',
    labPlaceholder: '在此输入您关于企业规则或制度的疑问...',
    labBtn: '立即咨询',
    labResult: '回答内容',
    labSources: '引用依据',
    uploadHint: '支持多文件并发处理',
    processing: '正在解析文件...',
    importSuccess: '导入完成',
    importError: '解析失败',
    labEmpty: '请在上方输入问题。AI 将实时检索关联的规则与参考制度并给出详尽解答。',
    tagLibrary: '智能标签库',
    allTags: '全部',
    thinking: '正在思考中...',
    categories: {
      Legal: '法律合规',
      Financial: '财务内控',
      Compliance: '合规准则',
      Technical: '技术标准',
      HR: '人力资源',
      Operational: '运营流程'
    }
  },
  en: {
    title: 'Knowledge Base',
    subtitle: 'Multi-modal Policy Analysis & Retrieval',
    tabRules: 'Review Rules',
    tabRefs: 'References',
    tabLab: 'Knowledge Lab',
    addRule: 'Add Rule',
    addRef: 'Add Reference',
    inputTitle: 'Title',
    inputContent: 'Enter content...',
    category: 'Category',
    status: 'Status',
    actions: 'Actions',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    empty: 'No items',
    searchPlaceholder: 'Search (Supports AND, OR, NOT)...',
    labPlaceholder: 'Ask anything about internal policies...',
    labBtn: 'Query',
    labResult: 'Answer',
    labSources: 'Citations',
    uploadHint: 'Multi-file concurrent processing',
    processing: 'Processing files...',
    importSuccess: 'Import completed',
    importError: 'Processing failed',
    labEmpty: 'Enter a question above to search the knowledge base.',
    tagLibrary: 'Smart Tags',
    allTags: 'All',
    thinking: 'Thinking...',
    categories: {
      Legal: 'Legal',
      Financial: 'Financial',
      Compliance: 'Compliance',
      Technical: 'Technical',
      HR: 'HR',
      Operational: 'Operational'
    }
  }
};

const RULE_CATEGORIES = ['Legal', 'Financial', 'Compliance', 'Technical'];
const REF_CATEGORIES = ['HR', 'Financial', 'Legal', 'Operational', 'Compliance'];

const RuleBase: React.FC<RuleBaseProps> = ({ rules, setRules, references, setReferences, language, modelProvider = 'Gemini' }) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'rules' | 'refs' | 'lab'>('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [labQuery, setLabQuery] = useState('');
  const [labResult, setLabResult] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  
  const [processingQueue, setProcessingQueue] = useState<ProcessingFile[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRefId, setEditingRefId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');
  const [tempCategory, setTempCategory] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const smartTags = useMemo(() => {
    const allTags = references.flatMap(ref => ref.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [references]);

  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    return rules.filter(r => matchBooleanQuery(`${r.title} ${r.content} ${r.category}`, searchQuery));
  }, [rules, searchQuery]);

  const filteredRefs = useMemo(() => {
    if (!searchQuery) return references;
    return references.filter(r => matchBooleanQuery(`${r.title} ${r.content} ${r.category} ${(r.tags || []).join(' ')}`, searchQuery));
  }, [references, searchQuery]);

  const handleAddEmptyRule = () => {
    const newRule: Rule = { id: Date.now().toString(), title: 'New Rule', content: '', category: 'Compliance', active: true };
    setRules(prev => [newRule, ...prev]);
    startEditingRule(newRule);
  };

  const startEditingRule = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setTempTitle(rule.title);
    setTempContent(rule.content);
    setTempCategory(rule.category);
  };

  const saveRuleEdit = () => {
    if (editingRuleId) {
      setRules(prev => prev.map(r => r.id === editingRuleId ? { ...r, title: tempTitle, content: tempContent, category: tempCategory as any } : r));
      setEditingRuleId(null);
    }
  };

  const startEditingRef = (ref: ReferenceDocument) => {
    setEditingRefId(ref.id);
    setTempTitle(ref.title);
    setTempContent(ref.content);
    setTempCategory(ref.category);
  };

  const saveRefEdit = () => {
    if (editingRefId) {
      setReferences(prev => prev.map(r => r.id === editingRefId ? { ...r, title: tempTitle, content: tempContent, category: tempCategory as any } : r));
      setEditingRefId(null);
    }
  };

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const deleteRule = (id: string) => setRules(prev => prev.filter(r => r.id !== id));
  const deleteRef = (id: string) => setReferences(prev => prev.filter(r => r.id !== id));

  const processFile = async (file: File) => {
    const fileId = Math.random().toString(36).substr(2, 9);
    setProcessingQueue(prev => [...prev, { id: fileId, name: file.name, status: 'processing' }]);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() as any;
      let text = '';
      if (extension === 'pdf') {
        const ab = await file.arrayBuffer();
        const lib = (pdfjsLib as any).default || pdfjsLib;
        const pdf = await lib.getDocument({ data: ab.slice(0) }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
      } else if (extension === 'docx') {
        const ab = await file.arrayBuffer();
        const mm = (mammoth as any).default || mammoth;
        const res = await mm.extractRawText({ arrayBuffer: ab.slice(0) });
        text = res.value;
      } else {
        text = await file.text();
      }
      if (!text.trim()) throw new Error("File content is empty");
      if (activeTab === 'rules') {
        const category = await categorizeText(text, RULE_CATEGORIES, modelProvider);
        setRules(prev => [{ id: Date.now().toString() + Math.random(), title: file.name, content: text, category: category as any, active: true }, ...prev]);
      } else {
        const [category, tags] = await Promise.all([categorizeText(text, REF_CATEGORIES, modelProvider), extractKeywords(text, 5, modelProvider)]);
        setReferences(prev => [{ id: Date.now().toString() + Math.random(), title: file.name, content: text, type: extension === 'pdf' ? 'pdf' : extension === 'docx' ? 'docx' : 'txt', category: category as any, active: true, tags: tags }, ...prev]);
      }
      setProcessingQueue(prev => prev.map(p => p.id === fileId ? { ...p, status: 'completed' } : p));
      setTimeout(() => setProcessingQueue(prev => prev.filter(p => p.id !== fileId)), 3000);
    } catch (e: any) {
      setProcessingQueue(prev => prev.map(p => p.id === fileId ? { ...p, status: 'error', error: e.message || 'Processing failed' } : p));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => processFile(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runLabQuery = async () => {
    if (!labQuery) return;
    setIsQuerying(true);
    setLabResult('');
    try {
      const combined = [...rules, ...references];
      // 显式传入 modelProvider
      const answer = await queryKnowledgeBase(labQuery, combined, language, modelProvider);
      setLabResult(answer);
    } catch (e) {
      setLabResult('Query failed.');
    } finally { setIsQuerying(false); }
  };

  const citedSources = useMemo(() => {
    if (!labResult) return [];
    const matches = labResult.match(/\[SOURCE: (.*?)\]/g);
    if (!matches) return [];
    const titles = matches.map(m => m.replace('[SOURCE: ', '').replace(']', ''));
    return [...new Set(titles)];
  }, [labResult]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部面板 - 保持紧凑 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 mb-4 flex justify-between items-center relative overflow-hidden shrink-0">
        {processingQueue.length > 0 && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-10 flex items-center px-8 gap-6 animate-in fade-in duration-300">
             <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                     <SparklesIcon className="w-3 h-3 animate-spin text-blue-600" />
                     {t.processing}
                   </h4>
                   <span className="text-[9px] font-bold text-slate-400">{processingQueue.filter(p => p.status === 'completed').length} / {processingQueue.length}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scroll-hide">
                   {processingQueue.map(p => (
                     <div key={p.id} className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-bold transition-all ${p.status === 'completed' ? 'bg-green-50 border-green-100 text-green-600' : p.status === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                        {p.status === 'processing' && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />}
                        {p.status === 'completed' && <CheckIcon className="w-3 h-3" />}
                        {p.status === 'error' && <ExclamationIcon className="w-3 h-3" />}
                        {p.name}
                     </div>
                   ))}
                </div>
             </div>
             <button onClick={() => setProcessingQueue([])} className="p-2 text-slate-400 hover:text-slate-600"><XMarkIcon /></button>
          </div>
        )}

        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tighter"><AcademicCapIcon /> {t.title}</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{t.subtitle}</p>
        </div>
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('rules')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rules' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.tabRules}</button>
          <button onClick={() => setActiveTab('refs')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'refs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.tabRefs}</button>
          <button onClick={() => setActiveTab('lab')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'lab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.tabLab}</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab !== 'lab' ? (
          <>
            <div className="flex gap-4 mb-4 shrink-0">
              <div className="flex-1 relative">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-12 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all" placeholder={t.searchPlaceholder} />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><DocumentSearchIcon /></div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.docx,.txt" multiple className="hidden" />
                <UploadIcon />
                {activeTab === 'rules' ? t.addRule : t.addRef}
              </button>
              {activeTab === 'rules' && (
                <button onClick={handleAddEmptyRule} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
                  <PlusIcon /> {t.addRule}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
              {activeTab === 'rules' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRules.map(rule => (
                    <div key={rule.id} className={`group bg-white rounded-3xl border transition-all p-5 ${rule.active ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60 grayscale'}`}>
                      {editingRuleId === rule.id ? (
                        <div className="space-y-4">
                          <input value={tempTitle} onChange={e => setTempTitle(e.target.value)} className="w-full text-xs font-black p-2 border border-indigo-200 rounded-xl outline-none" placeholder={t.inputTitle} />
                          <select value={tempCategory} onChange={e => setTempCategory(e.target.value)} className="w-full text-xs font-black p-2 border border-indigo-200 rounded-xl outline-none bg-white">
                            {RULE_CATEGORIES.map(cat => <option key={cat} value={cat}>{t.categories[cat as keyof typeof t.categories]}</option>)}
                          </select>
                          <textarea value={tempContent} onChange={e => setTempContent(e.target.value)} className="w-full h-32 text-xs p-2 border border-indigo-200 rounded-xl outline-none resize-none" placeholder={t.inputContent} />
                          <div className="flex gap-2">
                            <button onClick={saveRuleEdit} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"><CheckIcon className="inline mr-1" /> {t.save}</button>
                            <button onClick={() => setEditingRuleId(null)} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><BookIcon /></div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEditingRule(rule)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title={t.edit}><PencilIcon /></button>
                              <button onClick={() => toggleRule(rule.id)} className={`w-9 h-5 rounded-full relative transition-all ${rule.active ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${rule.active ? 'left-4.5' : 'left-0.5'}`}></div>
                              </button>
                              <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><TrashIcon /></button>
                            </div>
                          </div>
                          <h3 className="font-black text-slate-800 text-sm mb-1 tracking-tight line-clamp-1">{rule.title}</h3>
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-4 font-medium italic mb-3">"{rule.content}"</p>
                          <span className="inline-block px-2.5 py-0.5 bg-slate-100 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.categories[rule.category as keyof typeof t.categories]}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'refs' && (
                <div className="space-y-3">
                  {filteredRefs.map(ref => (
                    <div key={ref.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group transition-all hover:shadow-md">
                      {editingRefId === ref.id ? (
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <input value={tempTitle} onChange={e => setTempTitle(e.target.value)} className="flex-1 text-xs font-black p-3 border border-indigo-200 rounded-2xl outline-none" />
                            <select value={tempCategory} onChange={e => setTempCategory(e.target.value)} className="w-40 text-xs font-black p-3 border border-indigo-200 rounded-2xl outline-none bg-white">
                              {REF_CATEGORIES.map(cat => <option key={cat} value={cat}>{t.categories[cat as keyof typeof t.categories]}</option>)}
                            </select>
                          </div>
                          <textarea value={tempContent} onChange={e => setTempContent(e.target.value)} className="w-full h-40 text-xs p-3 border border-indigo-200 rounded-2xl outline-none resize-none" />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingRefId(null)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400">{t.cancel}</button>
                            <button onClick={saveRefEdit} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"><CheckIcon className="inline mr-1" /> {t.save}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-5">
                          <div className="p-3.5 bg-slate-50 text-slate-500 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <NewspaperIcon />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-0.5">
                                <h4 className="font-black text-slate-800 text-sm tracking-tight">{ref.title}</h4>
                                <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-widest">{ref.type}</span>
                            </div>
                            <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest mb-2">{t.categories[ref.category as keyof typeof t.categories]}</p>
                            {ref.tags && ref.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {ref.tags.map(tag => <span key={tag} className="px-2 py-0.5 bg-indigo-50/50 text-[8px] font-black text-indigo-400 border border-indigo-100/50 rounded-md uppercase">#{tag}</span>)}
                                </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => startEditingRef(ref)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title={t.edit}><PencilIcon /></button>
                            <button onClick={() => deleteRef(ref.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><TrashIcon /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
            {/* 顶栏输入区 - 极致压缩垂直空间 */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex gap-3 mb-3 shrink-0">
                <div className="flex-1 relative">
                    <input 
                        value={labQuery} 
                        onChange={e => setLabQuery(e.target.value)} 
                        className="w-full bg-slate-50 border border-transparent rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white focus:border-indigo-100 transition-all" 
                        placeholder={t.labPlaceholder}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), runLabQuery())}
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"><BoltIcon className="w-4 h-4" /></div>
                </div>
                <button 
                    onClick={runLabQuery} 
                    disabled={isQuerying || !labQuery} 
                    className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 disabled:opacity-20 shadow-lg transition-all active:scale-95 flex items-center gap-2 shrink-0"
                >
                    {isQuerying ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <SparklesIcon className="w-3.5 h-3.5" />}
                    {t.labBtn}
                </button>
            </div>

            {/* 左右分栏内容区 - 充满剩余空间 */}
            <div className="flex-1 flex gap-3 overflow-hidden min-h-0">
                {/* 左侧：主回答区 */}
                <div className="flex-[3] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
                    <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center shrink-0">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <NewspaperIcon className="w-3.5 h-3.5" /> {t.labResult}
                        </h4>
                        {labResult && (
                             <button onClick={() => navigator.clipboard.writeText(labResult)} className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><ClipboardIcon className="w-3.5 h-3.5" /></button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
                        {isQuerying ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
                                <div className="w-8 h-8 border-2 border-indigo-50 border-t-indigo-500 rounded-full animate-spin"></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">{t.thinking}</span>
                                    <span className="text-[8px] font-bold text-indigo-400/60 uppercase mt-1">Provider: {modelProvider}</span>
                                </div>
                            </div>
                        ) : labResult ? (
                            <div className="prose prose-slate prose-sm max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-slate-600 leading-relaxed">
                                <ReactMarkdown>{labResult.replace(/\[SOURCE:.*?\]/g, '')}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-12">
                                <BeakerIcon className="w-10 h-10 mb-3 text-slate-200" />
                                <p className="text-[11px] font-bold text-slate-400 leading-relaxed max-w-xs">{t.labEmpty}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：侧边元数据区 */}
                <div className="flex-1 flex flex-col gap-3 shrink-0 overflow-hidden min-w-[200px]">
                    {/* 引用依据 */}
                    {citedSources.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[50%] shrink-0">
                             <div className="px-3 py-2 border-b border-slate-100 bg-indigo-50/20 flex items-center gap-2 shrink-0">
                                <BookIcon className="w-3 h-3 text-indigo-600" />
                                <h4 className="text-[9px] font-black text-indigo-900 uppercase tracking-widest">{t.labSources}</h4>
                             </div>
                             <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar bg-indigo-50/5">
                                {citedSources.map((source, i) => (
                                    <div key={i} className="p-2.5 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all group cursor-default">
                                        <div className="flex gap-2 items-center">
                                            <span className="shrink-0 w-4.5 h-4.5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-black">{i + 1}</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate flex-1 uppercase tracking-tight">{source}</span>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {/* 智能标签 */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 shrink-0">
                            <SparklesIcon className="w-3 h-3 text-slate-400" />
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.tagLibrary}</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                            <div className="flex flex-wrap gap-1.5">
                                {smartTags.map(tag => (
                                    <button 
                                        key={tag} 
                                        onClick={() => setLabQuery(tag)} 
                                        className="px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all bg-slate-50 border border-slate-100 text-slate-500 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 active:scale-95"
                                    >
                                        #{tag}
                                    </button>
                                ))}
                                {smartTags.length === 0 && <span className="text-[8px] italic text-slate-300 py-2 block text-center w-full">暂无训练标签...</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleBase;
