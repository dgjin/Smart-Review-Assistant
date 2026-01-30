
import React, { useState, useRef, useEffect } from 'react';
import { Rule, Language } from '../types';
import { PlusIcon, TrashIcon, BookIcon, UploadIcon, EyeIcon, XMarkIcon } from './Icons';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Try to handle PDF.js imports which can be tricky with ESM/CDNs
const initPdfWorker = () => {
  if (typeof window !== 'undefined' && pdfjsLib) {
    // Fix: Handle PDF.js import differences by casting to any to access potential default property
    const lib = (pdfjsLib as any).default || pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) {
      // Use unpkg for the worker script to ensure it's a classic script, not an ESM wrapper
      // This fixes the "Failed to execute 'importScripts'" error
      lib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }
};

initPdfWorker();

interface RuleBaseProps {
  rules: Rule[];
  setRules: React.Dispatch<React.SetStateAction<Rule[]>>;
  language: Language;
}

const translations = {
  zh: {
    title: '规则知识库',
    subtitle: '配置智能审查助手的本地法规与制度',
    activeRules: '生效规则',
    addTitle: '添加新规则',
    inputTitle: '规则标题 (例如：2024年采购管理办法)',
    inputContent: '在此粘贴规则或条款的完整内容...',
    addButton: '添加到知识库',
    noRules: '暂无规则。请添加规则以开始训练助手。',
    active: '已启用',
    inactive: '已停用',
    categories: {
      Legal: '法律',
      Financial: '财务',
      Compliance: '合规',
      Technical: '技术'
    },
    uploadRule: '导入文件',
    uploading: '解析中...',
    supportedFormats: '支持 PDF, Word (.docx), Text (.txt)',
    viewDetails: '查看详情',
    close: '关闭'
  },
  en: {
    title: 'Rule Knowledge Base',
    subtitle: 'Configure the local regulations for the auditing assistant.',
    activeRules: 'Active Rules',
    addTitle: 'Add New Regulation',
    inputTitle: 'Regulation Title (e.g. Procurement Policy 2024)',
    inputContent: 'Paste the full content of the rule or regulation clause here...',
    addButton: 'Add to Knowledge Base',
    noRules: 'No rules defined. Add a rule to start training the assistant.',
    active: 'Active',
    inactive: 'Inactive',
    categories: {
      Legal: 'Legal',
      Financial: 'Financial',
      Compliance: 'Compliance',
      Technical: 'Technical'
    },
    uploadRule: 'Import File',
    uploading: 'Parsing...',
    supportedFormats: 'Supports PDF, Word (.docx), Text (.txt)',
    viewDetails: 'View Details',
    close: 'Close'
  }
};

const RuleBase: React.FC<RuleBaseProps> = ({ rules, setRules, language }) => {
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleContent, setNewRuleContent] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<Rule['category']>('Legal');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingRule, setViewingRule] = useState<Rule | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const t = translations[language];

  const handleAddRule = () => {
    if (!newRuleTitle || !newRuleContent) return;

    const rule: Rule = {
      id: Date.now().toString(),
      title: newRuleTitle,
      content: newRuleContent,
      category: newRuleCategory,
      active: true,
    };

    setRules([...rules, rule]);
    setNewRuleTitle('');
    setNewRuleContent('');
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    if (viewingRule?.id === id) setViewingRule(null);
  };

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
    if (viewingRule?.id === id) {
        setViewingRule(prev => prev ? {...prev, active: !prev.active} : null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();
    const titleWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

    try {
      const reader = new FileReader();

      if (extension === 'docx') {
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            setNewRuleTitle(titleWithoutExt);
            setNewRuleContent(result.value);
          } catch (err) {
            console.error(err);
            alert('Failed to parse .docx file');
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'pdf') {
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            
            // Fix: Handle PDF lib import differences by casting to any to access potential default property
            const lib = (pdfjsLib as any).default || pdfjsLib;
            const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            
            // Iterate over all pages
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              // Combine text items
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += pageText + '\n\n';
            }

            setNewRuleTitle(titleWithoutExt);
            setNewRuleContent(fullText);
          } catch (err) {
            console.error(err);
            alert('Failed to parse PDF file. Ensure it is a valid PDF.');
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Assume text for .txt or others
        reader.onload = (event) => {
           setNewRuleTitle(titleWithoutExt);
           setNewRuleContent(event.target?.result as string);
           setIsUploading(false);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error(error);
      setIsUploading(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookIcon /> {t.title}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
            {rules.filter(r => r.active).length} {t.activeRules}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6">
        
        {/* Left: Input Form */}
        <div className="md:w-1/3 flex flex-col gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 h-fit">
          <h3 className="font-semibold text-slate-700">{t.addTitle}</h3>
          
          <div className="bg-white p-3 border border-slate-200 rounded-md mb-2">
             <input 
               type="file" 
               ref={fileInputRef}
               onChange={handleFileUpload}
               accept=".docx,.pdf,.txt"
               className="hidden"
             />
             <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-slate-200 border-dashed"
             >
                {isUploading ? (
                    <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                    <UploadIcon />
                )}
                {isUploading ? t.uploading : t.uploadRule}
             </button>
             <p className="text-[10px] text-slate-400 text-center mt-1">{t.supportedFormats}</p>
          </div>

          <div className="relative border-t border-slate-200 my-1">
             <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 bg-slate-50 px-2 text-xs text-slate-400">OR</span>
          </div>

          <input 
            type="text" 
            placeholder={t.inputTitle}
            className="p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={newRuleTitle}
            onChange={(e) => setNewRuleTitle(e.target.value)}
          />

          <select 
            className="p-2 border border-slate-300 rounded-md text-sm outline-none"
            value={newRuleCategory}
            onChange={(e) => setNewRuleCategory(e.target.value as any)}
          >
            <option value="Legal">{t.categories.Legal}</option>
            <option value="Financial">{t.categories.Financial}</option>
            <option value="Compliance">{t.categories.Compliance}</option>
            <option value="Technical">{t.categories.Technical}</option>
          </select>

          <textarea 
            placeholder={t.inputContent}
            className="p-2 border border-slate-300 rounded-md text-sm h-40 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            value={newRuleContent}
            onChange={(e) => setNewRuleContent(e.target.value)}
          />

          <button 
            onClick={handleAddRule}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            disabled={!newRuleTitle || !newRuleContent}
          >
            <PlusIcon /> {t.addButton}
          </button>
        </div>

        {/* Right: List */}
        <div className="md:w-2/3 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p>{t.noRules}</p>
            </div>
          ) : (
            rules.map(rule => (
              <div 
                key={rule.id} 
                className={`p-4 rounded-lg border flex gap-4 ${rule.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
              >
                <div className="flex-1 cursor-pointer" onClick={() => setViewingRule(rule)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider
                      ${rule.category === 'Financial' ? 'bg-green-100 text-green-700' : 
                        rule.category === 'Legal' ? 'bg-red-100 text-red-700' : 
                        rule.category === 'Technical' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}
                    >
                      {t.categories[rule.category]}
                    </span>
                    <h4 className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">{rule.title}</h4>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{rule.content}</p>
                </div>
                
                <div className="flex flex-col items-center justify-center gap-2 border-l pl-4 border-slate-100">
                  <button
                    onClick={() => setViewingRule(rule)}
                    className="text-slate-400 hover:text-blue-500 transition-colors"
                    title={t.viewDetails}
                  >
                    <EyeIcon />
                  </button>
                  <button 
                    onClick={() => toggleRule(rule.id)}
                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${rule.active ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                  >
                    {rule.active ? t.active : t.inactive}
                  </button>
                  <button 
                    onClick={() => deleteRule(rule.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View Detail Modal */}
      {viewingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
               <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <BookIcon /> {viewingRule.title}
               </h3>
               <button onClick={() => setViewingRule(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <XMarkIcon />
               </button>
            </div>
            <div className="p-6 overflow-y-auto">
               <div className="flex items-center gap-2 mb-6">
                  <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider
                    ${viewingRule.category === 'Financial' ? 'bg-green-100 text-green-700' : 
                      viewingRule.category === 'Legal' ? 'bg-red-100 text-red-700' : 
                      viewingRule.category === 'Technical' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}
                  >
                    {t.categories[viewingRule.category]}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${viewingRule.active ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                      {viewingRule.active ? t.active : t.inactive}
                  </span>
               </div>
               <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {viewingRule.content}
               </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
               <button onClick={() => setViewingRule(null)} className="px-5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700 shadow-sm transition-colors">
                  {t.close}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleBase;
