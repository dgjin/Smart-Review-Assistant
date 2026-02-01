
import React, { useState, useEffect } from 'react';
import { Rule, Language, ModelProvider, ReviewSession, ReferenceDocument, AISettings } from './types';
import RuleBase from './components/RuleBase';
import ReviewPanel from './components/ReviewPanel';
import ContentDistiller from './components/ContentDistiller';
import { BookIcon, DocumentSearchIcon, CpuChipIcon, AcademicCapIcon, InformationCircleIcon, NewspaperIcon, Cog6ToothIcon, XMarkIcon, CheckIcon, SaveIcon } from './components/Icons';

const INITIAL_RULES_ZH: Rule[] = [
  { id: '1', title: '供应商采购限额', content: '任何超过50,000美元的采购必须经过公开招标程序。严禁在此阈值以上进行直接采购。', category: 'Financial', active: true },
  { id: '2', title: '数据隐私合规', content: '所有处理客户数据的供应商必须持有ISO 27001认证，并在合同执行前签署数据处理协议（DPA）。', category: 'Legal', active: true },
  { id: '3', title: '付款条款标准', content: '标准付款期限为净60天。任何要求净30天或预付款的偏差都需要CFO批准。', category: 'Financial', active: true }
];

const translations = {
  zh: { 
    appName: '智能审查助手', 
    appDesc: '基于本地知识库的智能分析系统', 
    menuReview: '审查工作台', 
    menuRules: '知识与训练', 
    menuDistill: '内容提炼总结',
    statusActive: '在线', 
    modelSelect: '引擎选择',
    settingsTitle: '引擎配置中心',
    settingsDesc: '在此配置第三方大模型引擎。Gemini 密钥由系统自动注入。',
    saveBtn: '保存配置',
    savedMsg: '配置已生效',
    modelTooltips: {
      gemini: "Gemini 3 Pro: 专家级推理，支持多模态（PDF/图片），适合深度合规分析与制度理解。",
      deepseek: "DeepSeek V3: 极速文本处理，逻辑严密，适合长篇文档摘要与纯文本风险点核查。",
      minimax: "MiniMax-M2.1: 优秀的中文上下文理解能力，回复风格专业，适合规章制度的精细化问答。"
    }
  },
  en: { 
    appName: 'SmartAudit AI', 
    appDesc: 'Local Knowledge Based Review System', 
    menuReview: 'Review Workspace', 
    menuRules: 'Training Center', 
    menuDistill: 'Distillation',
    statusActive: 'Active', 
    modelSelect: 'Model Engine',
    settingsTitle: 'AI Configuration',
    settingsDesc: 'Manage API keys for non-Gemini providers. Gemini is pre-configured.',
    saveBtn: 'Save Settings',
    savedMsg: 'Settings Saved',
    modelTooltips: {
      gemini: "Gemini 3 Pro: Expert reasoning, multimodal (PDF/Images), best for deep compliance & policy analysis.",
      deepseek: "DeepSeek V3: Ultra-fast text processing, logical rigor, ideal for long document summaries & text risk checks.",
      minimax: "MiniMax-M2.1: Exceptional Chinese context understanding, highly professional tone for Q&A."
    }
  }
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'rules' | 'review' | 'distill'>('review');
  const [rules, setRules] = useState<Rule[]>(() => {
    const saved = localStorage.getItem('sra_rules');
    return saved ? JSON.parse(saved) : INITIAL_RULES_ZH;
  });
  const [references, setReferences] = useState<ReferenceDocument[]>(() => {
    const saved = localStorage.getItem('sra_refs');
    return saved ? JSON.parse(saved) : [];
  });
  const [language, setLanguage] = useState<Language>('zh');
  const [modelProvider, setModelProvider] = useState<ModelProvider>('Gemini');
  const [sessions, setSessions] = useState<ReviewSession[]>(() => {
    const saved = localStorage.getItem('sra_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  // 设置状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('sra_ai_settings');
    return saved ? JSON.parse(saved) : { deepseekKey: '', deepseekBaseUrl: '', minimaxKey: '' };
  });
  const [isSettingsSaved, setIsSettingsSaved] = useState(false);

  useEffect(() => localStorage.setItem('sra_rules', JSON.stringify(rules)), [rules]);
  useEffect(() => localStorage.setItem('sra_refs', JSON.stringify(references)), [references]);
  useEffect(() => localStorage.setItem('sra_sessions', JSON.stringify(sessions)), [sessions]);
  useEffect(() => localStorage.setItem('sra_ai_settings', JSON.stringify(aiSettings)), [aiSettings]);

  const t = translations[language];

  const updateSession = (updatedSession: ReviewSession) => {
    setSessions(prev => {
      const exists = prev.find(s => s.id === updatedSession.id);
      return exists ? prev.map(s => s.id === updatedSession.id ? updatedSession : s) : [updatedSession, ...prev];
    });
  };

  const deleteSession = (id: string) => setSessions(prev => prev.filter(s => s.id !== id));

  const handleSaveSettings = () => {
    setIsSettingsSaved(true);
    setTimeout(() => {
      setIsSettingsSaved(false);
      setIsSettingsOpen(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-900 font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
        <div className="p-8">
          <h1 className="text-xl font-black text-white tracking-tighter mb-1">{t.appName}</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.appDesc}</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setCurrentView('review')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${currentView === 'review' ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
            <DocumentSearchIcon /> <span className="font-bold text-sm tracking-tight">{t.menuReview}</span>
          </button>
          <button onClick={() => setCurrentView('distill')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${currentView === 'distill' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/50' : 'hover:bg-slate-800'}`}>
            <NewspaperIcon /> <span className="font-bold text-sm tracking-tight">{t.menuDistill}</span>
          </button>
          <button onClick={() => setCurrentView('rules')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${currentView === 'rules' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/50' : 'hover:bg-slate-800'}`}>
            <AcademicCapIcon /> <span className="font-bold text-sm tracking-tight">{t.menuRules}</span>
          </button>
        </nav>
        
        <div className="p-6 border-t border-slate-800 space-y-4">
           {/* 配置按钮 */}
           <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors group">
              <div className="flex items-center gap-3">
                 <Cog6ToothIcon className="text-slate-500 group-hover:rotate-90 transition-transform duration-500" />
                 <span className="text-xs font-bold text-slate-400">Settings</span>
              </div>
              {(!aiSettings.deepseekKey || !aiSettings.minimaxKey) && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>}
           </button>

           <div className="bg-slate-800 rounded-xl p-3 relative group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <CpuChipIcon /> <span className="text-[10px] font-black uppercase tracking-widest">{t.modelSelect}</span>
                </div>
                <div className="relative group/tooltip">
                   <InformationCircleIcon />
                   <div className="absolute left-full ml-3 bottom-0 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 leading-relaxed font-medium">
                      <p className="mb-2"><strong className="text-blue-400">Gemini:</strong> {t.modelTooltips.gemini}</p>
                      <p className="mb-2"><strong className="text-indigo-400">DeepSeek:</strong> {t.modelTooltips.deepseek}</p>
                      <p><strong className="text-orange-400">MiniMax:</strong> {t.modelTooltips.minimax}</p>
                      <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-slate-700"></div>
                   </div>
                </div>
              </div>
              <select value={modelProvider} onChange={(e) => setModelProvider(e.target.value as ModelProvider)} className="w-full bg-slate-700 text-white text-xs p-2.5 rounded-lg outline-none font-bold border-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer">
                <option value="Gemini">Gemini 3.0 Pro</option>
                <option value="DeepSeek">DeepSeek V3</option>
                <option value="MiniMax">MiniMax-M2.1</option>
              </select>
           </div>
           <div className="flex bg-slate-800 p-1 rounded-xl">
             <button onClick={() => setLanguage('zh')} className={`flex-1 py-1.5 text-xs font-black rounded-lg ${language === 'zh' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>中文</button>
             <button onClick={() => setLanguage('en')} className={`flex-1 py-1.5 text-xs font-black rounded-lg ${language === 'en' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>EN</button>
           </div>
           <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse bg-green-500`}></span>
              <span className="text-[10px] font-black text-slate-200 uppercase">{modelProvider} {t.statusActive}</span>
           </div>
        </div>
      </aside>
      <main className="flex-1 p-6 h-full overflow-hidden">
        {currentView === 'rules' && (
          <RuleBase rules={rules} setRules={setRules} references={references} setReferences={setReferences} language={language} modelProvider={modelProvider} />
        )}
        {currentView === 'review' && (
          <ReviewPanel rules={rules} references={references} language={language} modelProvider={modelProvider} sessions={sessions} onUpdateSession={updateSession} onDeleteSession={deleteSession} />
        )}
        {currentView === 'distill' && (
          <ContentDistiller language={language} modelProvider={modelProvider} />
        )}
      </main>

      {/* 配置模态框 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">{t.settingsTitle}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.settingsDesc}</p>
                 </div>
                 <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"><XMarkIcon /></button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto">
                 {/* DeepSeek Section */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-600">
                       <CpuChipIcon className="w-4 h-4" />
                       <h4 className="text-[10px] font-black uppercase tracking-widest">DeepSeek V3 Configuration</h4>
                    </div>
                    <div className="space-y-3">
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key</label>
                          <input 
                            type="password" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all font-mono" 
                            placeholder="sk-..." 
                            value={aiSettings.deepseekKey}
                            onChange={(e) => setAiSettings({...aiSettings, deepseekKey: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Base URL (Optional)</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all" 
                            placeholder="https://api.deepseek.com/v1" 
                            value={aiSettings.deepseekBaseUrl}
                            onChange={(e) => setAiSettings({...aiSettings, deepseekBaseUrl: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 {/* MiniMax Section */}
                 <div className="space-y-4 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-orange-600">
                       <CpuChipIcon className="w-4 h-4" />
                       <h4 className="text-[10px] font-black uppercase tracking-widest">MiniMax-M2.1 Configuration</h4>
                    </div>
                    <div className="space-y-3">
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key</label>
                          <input 
                            type="password" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all font-mono" 
                            placeholder="MM-..." 
                            value={aiSettings.minimaxKey}
                            onChange={(e) => setAiSettings({...aiSettings, minimaxKey: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                    <InformationCircleIcon className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                       {language === 'zh' 
                         ? 'Gemini 3 Pro 已由系统环境预配置，无需额外设置。本系统优先使用本地设置中的第三方密钥进行真实切换。' 
                         : 'Gemini 3 Pro is pre-configured via the environment. Local settings override external providers for real switching.'}
                    </p>
                 </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                 <button onClick={handleSaveSettings} className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
                    isSettingsSaved ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                 }`}>
                    {isSettingsSaved ? <CheckIcon /> : <SaveIcon />}
                    {isSettingsSaved ? t.savedMsg : t.saveBtn}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
