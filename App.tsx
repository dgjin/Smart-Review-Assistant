
import React, { useState, useEffect } from 'react';
import { Rule, Language, ModelProvider, ReviewSession } from './types';
import RuleBase from './components/RuleBase';
import ReviewPanel from './components/ReviewPanel';
import { BookIcon, DocumentSearchIcon, CpuChipIcon } from './components/Icons';

// Initial data in Chinese as default
const INITIAL_RULES_ZH: Rule[] = [
  {
    id: '1',
    title: '供应商采购限额',
    content: '任何超过50,000美元的采购必须经过公开招标程序。严禁在此阈值以上进行直接采购。',
    category: 'Financial',
    active: true,
  },
  {
    id: '2',
    title: '数据隐私合规',
    content: '所有处理客户数据的供应商必须持有ISO 27001认证，并在合同执行前签署数据处理协议（DPA）。',
    category: 'Legal',
    active: true,
  },
  {
    id: '3',
    title: '付款条款标准',
    content: '标准付款期限为净60天。任何要求净30天或预付款的偏差都需要CFO批准。',
    category: 'Financial',
    active: true,
  }
];

const translations = {
  zh: {
    appName: '智能审查助手',
    appDesc: '智能业务辅助系统',
    menuReview: '审查工作台',
    menuRules: '规则知识库',
    statusTitle: '系统状态',
    statusActive: '已连接',
    modelSelect: '模型选择'
  },
  en: {
    appName: 'SmartAudit AI',
    appDesc: 'Intelligent Review Assistant',
    menuReview: 'Review Dashboard',
    menuRules: 'Rule Knowledge Base',
    statusTitle: 'System Status',
    statusActive: 'Active',
    modelSelect: 'Model Selection'
  }
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'rules' | 'review'>('review');
  const [rules, setRules] = useState<Rule[]>(() => {
    const saved = localStorage.getItem('sra_rules');
    return saved ? JSON.parse(saved) : INITIAL_RULES_ZH;
  });
  const [language, setLanguage] = useState<Language>('zh');
  const [modelProvider, setModelProvider] = useState<ModelProvider>('Gemini');
  
  // Session History Management
  const [sessions, setSessions] = useState<ReviewSession[]>(() => {
    const saved = localStorage.getItem('sra_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist rules and sessions
  useEffect(() => {
    localStorage.setItem('sra_rules', JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem('sra_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const t = translations[language];

  const updateSession = (updatedSession: ReviewSession) => {
    setSessions(prev => {
      const exists = prev.find(s => s.id === updatedSession.id);
      if (exists) {
        return prev.map(s => s.id === updatedSession.id ? updatedSession : s);
      } else {
        return [updatedSession, ...prev];
      }
    });
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-900 font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 transition-all duration-300">
        <div className="p-6">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-xl font-bold text-white tracking-tight">{t.appName}</h1>
          </div>
          <p className="text-xs text-slate-500">{t.appDesc}</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setCurrentView('review')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'review' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'hover:bg-slate-800'
            }`}
          >
            <DocumentSearchIcon />
            <span className="font-medium text-sm">{t.menuReview}</span>
          </button>

          <button
            onClick={() => setCurrentView('rules')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'rules' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'hover:bg-slate-800'
            }`}
          >
            <BookIcon />
            <span className="font-medium text-sm">{t.menuRules}</span>
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-4">
           
           {/* Model Selector */}
           <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <CpuChipIcon />
                <span className="text-xs font-medium">{t.modelSelect}</span>
              </div>
              <select 
                value={modelProvider} 
                onChange={(e) => setModelProvider(e.target.value as ModelProvider)}
                className="w-full bg-slate-700 text-white text-xs p-2 rounded outline-none border border-slate-600 focus:border-blue-500 cursor-pointer"
              >
                <option value="Gemini">Gemini 3.0 Pro/Flash</option>
                <option value="DeepSeek">DeepSeek V3</option>
              </select>
           </div>

           {/* Language Switcher */}
           <div className="flex bg-slate-800 p-1 rounded-lg">
             <button 
               onClick={() => setLanguage('zh')}
               className={`flex-1 py-1 text-xs font-medium rounded ${language === 'zh' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
             >
               中文
             </button>
             <button 
               onClick={() => setLanguage('en')}
               className={`flex-1 py-1 text-xs font-medium rounded ${language === 'en' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
             >
               English
             </button>
           </div>

           <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{t.statusTitle}</p>
              <div className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full animate-pulse ${modelProvider === 'Gemini' ? 'bg-green-500' : 'bg-purple-500'}`}></span>
                 <span className="text-xs font-semibold text-slate-200">{modelProvider} {t.statusActive}</span>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 h-full overflow-hidden">
        {currentView === 'rules' ? (
          <RuleBase rules={rules} setRules={setRules} language={language} />
        ) : (
          <ReviewPanel 
            rules={rules} 
            language={language} 
            modelProvider={modelProvider}
            sessions={sessions}
            onUpdateSession={updateSession}
            onDeleteSession={deleteSession}
          />
        )}
      </main>
    </div>
  );
};

export default App;
