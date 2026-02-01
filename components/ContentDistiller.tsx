
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Language, ModelProvider, ReviewDocument, DistillSession, ImageAdjustments } from '../types';
import { generateSummary, generateIllustration, generateCreativeVisual, reimagineVisual } from '../services/geminiService';
import { 
  NewspaperIcon, UploadIcon, SparklesIcon, TrashIcon, DownloadIcon, 
  XMarkIcon, EyeIcon, PresentationIcon, MapIcon, BoltIcon, BookIcon, 
  ArrowsPointingOutIcon, CameraIcon, PhotoIcon, ExclamationIcon,
  InformationCircleIcon, ClockIcon, PlusIcon, PencilIcon, CheckIcon, SaveIcon,
  ChartBarIcon
} from './Icons';
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

interface ContentDistillerProps {
  language: Language;
  modelProvider: ModelProvider;
}

const THEMES = [
  { id: 'azure', name: 'Azure Business', color: '#2563eb', text: 'Corporate Blue' },
  { id: 'emerald', name: 'Emerald Growth', color: '#10b981', text: 'Eco Green' },
  { id: 'rose', name: 'Rose Impact', color: '#f43f5e', text: 'Modern Rose' },
  { id: 'amber', name: 'Amber Insight', color: '#f59e0b', text: 'Golden Amber' },
  { id: 'slate', name: 'Slate Minimal', color: '#475569', text: 'Industrial Slate' },
  { id: 'violet', name: 'Violet Vision', color: '#8b5cf6', text: 'Future Violet' },
];

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  grayscale: 0,
  sepia: 0,
  blur: 0
};

const translations = {
  zh: {
    title: '内容提炼总结',
    subtitle: 'AI 极速精读与创意可视化生成系统',
    uploadZone: '导入材料',
    btnDistill: '立即提炼',
    btnNew: '新建任务',
    distilling: 'AI 深度精读中...',
    optionsTitle: '分析维度',
    historyTitle: '提炼历史',
    viewMode: { text: '文本阅读', visual: '创意演示', present: '播放演示' },
    options: {
      Executive: { label: '执行摘要', icon: <BookIcon /> },
      Keywords: { label: '关键要素', icon: <BoltIcon /> },
      Mindmap: { label: '思维导图', icon: <MapIcon /> },
      SWOT: { label: 'SWOT 分析', icon: <SparklesIcon /> },
      PPT: { label: '创意演示', icon: <PresentationIcon /> },
      Infographic: { label: '信息图表', icon: <ChartBarIcon /> },
      Poster: { label: '视觉海报', icon: <PhotoIcon /> }
    },
    slideConfig: {
      title: '演示文稿定制',
      logo: '上传 Logo',
      theme: '配色方案',
      removeLogo: '移除'
    },
    editVisual: {
      title: '视觉素材编辑器',
      brightness: '亮度',
      contrast: '对比度',
      saturate: '饱和度',
      grayscale: '灰度',
      sepia: '怀旧',
      blur: '模糊',
      aiReimagine: 'AI 重新创作',
      reimaginePlaceholder: '描述你想要的改变 (如: 变得更柔和, 加入落日感)...',
      reimagineBtn: 'AI 重新生成',
      reset: '重置',
      close: '关闭',
      processing: 'AI 正在重新构思...'
    },
    noDocs: '请上传文档开始分析',
    noHistory: '暂无历史记录',
    resultTitle: '智能分析报告',
    actions: {
      download: '下载报告',
      saveImage: '保存图片',
      clear: '清空',
      delete: '删除',
      rename: '重命名',
      close: '关闭演示',
      edit: '编辑视觉'
    },
    prompts: {
      Mindmap: '请生成一个层级清晰的手绘风格思维导图大纲（使用 Markdown 嵌套列表格式）。内容需涵盖文档的所有核心维度。',
      PPT: '请生成一个高度视觉化的幻灯片大纲。每一页只需 1 个核心标题和 3 个金句。格式：[Slide X: 标题] 内容。',
      Executive: '模式：执行摘要。请生成专业且逻辑清晰的提炼报告。',
      Keywords: '模式：关键要素。提取核心关键词和核心数据点。',
      SWOT: '模式：SWOT 分析。请严格按照 [Strengths], [Weaknesses], [Opportunities], [Threats] 输出。',
      Infographic: '模式：信息图表。请提炼出文档的 4 个核心支柱要素。格式：[Pillar X: 标题] 描述文字。',
      Poster: 'CREATIVE_IMAGE_MODE'
    }
  },
  en: {
    title: 'Content Distiller',
    subtitle: 'AI Fast-Reading & Creative Visualization',
    uploadZone: 'Upload Files',
    btnDistill: 'Distill Now',
    btnNew: 'New Task',
    distilling: 'AI Distilling...',
    optionsTitle: 'Dimensions',
    historyTitle: 'History',
    viewMode: { text: 'Reading Mode', visual: 'Creative Mode', present: 'Present' },
    options: {
      Executive: { label: 'Executive Summary', icon: <BookIcon /> },
      Keywords: { label: 'Key Takeaways', icon: <BoltIcon /> },
      Mindmap: { label: 'Mindmap', icon: <MapIcon /> },
      SWOT: { label: 'SWOT Analysis', icon: <SparklesIcon /> },
      PPT: { label: 'Creative Slides', icon: <PresentationIcon /> },
      Infographic: { label: 'Infographic', icon: <ChartBarIcon /> },
      Poster: { label: 'Visual Poster', icon: <PhotoIcon /> }
    },
    slideConfig: {
      title: 'Slide Customization',
      logo: 'Upload Logo',
      theme: 'Theme Color',
      removeLogo: 'Remove'
    },
    editVisual: {
      title: 'Visual Editor',
      brightness: 'Brightness',
      contrast: 'Contrast',
      saturate: 'Saturate',
      grayscale: 'Grayscale',
      sepia: 'Sepia',
      blur: 'Blur',
      aiReimagine: 'AI Reimagine',
      reimaginePlaceholder: 'Describe changes (e.g., softer lighting, add sunset vibes)...',
      reimagineBtn: 'Regenerate',
      reset: 'Reset',
      close: 'Close',
      processing: 'AI reimagining...'
    },
    noDocs: 'Upload to start',
    noHistory: 'No history yet',
    resultTitle: 'Analysis Report',
    actions: {
      download: 'Export Report',
      saveImage: 'Save Image',
      clear: 'Clear',
      delete: 'Delete',
      rename: 'Rename',
      close: 'Close Presentation',
      edit: 'Edit Visual'
    },
    prompts: {
      Mindmap: 'Generate a hierarchical mindmap outline using nested Markdown lists. Style it for a conceptual sketch.',
      PPT: 'Generate a highly visual slide outline. Each slide: 1 title and 3 key points. Format: [Slide X: Title] content.',
      Executive: 'Mode: Executive Summary. Professional report.',
      Keywords: 'Mode: Key Takeaways. Extract main keys and data.',
      SWOT: 'Mode: SWOT Analysis. Use [Strengths], [Weaknesses], [Opportunities], [Threats].',
      Infographic: 'Mode: Infographic. Extract 4 core pillars of the document. Format: [Pillar X: Title] Description text.',
      Poster: 'CREATIVE_IMAGE_MODE'
    }
  }
};

const ContentDistiller: React.FC<ContentDistillerProps> = ({ language, modelProvider }) => {
  const t = translations[language];
  const [history, setHistory] = useState<DistillSession[]>(() => {
    const saved = localStorage.getItem('sra_distill_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [distillType, setDistillType] = useState<string>('Executive');
  const [result, setResult] = useState<string>('');
  const [visualData, setVisualData] = useState<Record<string, string>>({});
  const [visualAdjustments, setVisualAdjustments] = useState<Record<string, ImageAdjustments>>({});
  
  // Customization State
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [viewMode, setViewMode] = useState<'text' | 'visual'>('text');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Image Editing Panel State
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [reimaginePrompt, setReimaginePrompt] = useState('');
  const [isReimagining, setIsReimagining] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('sra_distill_history', JSON.stringify(history));
  }, [history]);

  // Sync current session to state
  const currentSession = useMemo(() => 
    history.find(s => s.id === currentSessionId), 
    [history, currentSessionId]
  );

  useEffect(() => {
    if (currentSession) {
      setDocuments(currentSession.documents);
      setResult(currentSession.result);
      setDistillType(currentSession.type);
      setVisualData(currentSession.visualData || {});
      setVisualAdjustments(currentSession.visualAdjustments || {});
      setLogoUrl(currentSession.config?.logoUrl);
      const themeId = currentSession.config?.themeColor;
      if (themeId) {
        const found = THEMES.find(th => th.id === themeId);
        if (found) setSelectedTheme(found);
      }
      setCurrentSlide(0);
    }
  }, [currentSessionId]);

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!result || distillType !== 'PPT' || isEditPanelOpen) return;
      const slidesCount = result.split(/\[Slide \d+:/i).length - 1;
      
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        setCurrentSlide(prev => Math.min(slidesCount - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        setCurrentSlide(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        setIsPresentationOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, distillType, isEditPanelOpen]);

  // Auto-generate creative visuals
  useEffect(() => {
    const triggerVisualGen = async () => {
      if (viewMode !== 'visual' || !result || isGeneratingVisual) return;
      const visualKey = distillType === 'PPT' ? `PPT_${currentSlide}` : distillType;
      if (visualData[visualKey]) return;

      setIsGeneratingVisual(true);
      try {
        let contentToImagine = result;
        if (distillType === 'PPT') {
          const slides = result.split(/\[Slide \d+:/i).filter(s => s.trim().length > 0);
          contentToImagine = slides[currentSlide] || result;
        } else if (distillType === 'Infographic') {
          // Use whole result for infographic metaphor
          contentToImagine = result;
        }
        const imageUrl = await generateCreativeVisual(contentToImagine, distillType, language, selectedTheme.text);
        
        // Update history cache
        const newVisualData = { ...visualData, [visualKey]: imageUrl };
        setVisualData(newVisualData);
        if (currentSessionId) {
          setHistory(prev => prev.map(s => s.id === currentSessionId ? { ...s, visualData: newVisualData } : s));
        }
      } catch (e) {
        console.error("Visual generation failed", e);
      } finally {
        setIsGeneratingVisual(false);
      }
    };
    triggerVisualGen();
  }, [viewMode, result, distillType, currentSlide, visualData, currentSessionId, language, selectedTheme]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const parserPromises = (Array.from(files) as File[]).map(async (file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let content = '';
      let extractedText = '';
      let mimeType = file.type || 'text/plain';

      try {
        if (extension === 'docx') {
          const ab = await file.arrayBuffer();
          const mm = (mammoth as any).default || mammoth;
          const res = await mm.extractRawText({ arrayBuffer: ab.slice(0) });
          content = res.value;
          extractedText = res.value;
        } else if (extension === 'pdf') {
          mimeType = 'application/pdf';
          const ab = await file.arrayBuffer();
          const base64Content = btoa(new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), ''));
          const lib = (pdfjsLib as any).default || pdfjsLib;
          const pdf = await lib.getDocument({ data: ab.slice(0) }).promise;
          let textStr = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            textStr += textContent.items.map((it: any) => it.str).join(' ') + '\n';
          }
          return { id: Math.random().toString(36).substr(2, 9), name: file.name, content: base64Content, extractedText: textStr, type: 'pdf', mimeType } as ReviewDocument;
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension || '')) {
          const ab = await file.arrayBuffer();
          const base64Content = btoa(new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), ''));
          return { id: Math.random().toString(36).substr(2, 9), name: file.name, content: base64Content, type: 'txt', mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension}` } as ReviewDocument;
        } else {
          content = await file.text();
          extractedText = content;
        }
        return { id: Math.random().toString(36).substr(2, 9), name: file.name, content, extractedText, type: 'txt', mimeType } as ReviewDocument;
      } catch (err) { 
        console.error("File upload error", err);
        return null; 
      }
    });

    const results = await Promise.all(parserPromises);
    const validDocs = results.filter((r): r is ReviewDocument => r !== null);
    setDocuments(prev => [...prev, ...validDocs]);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setLogoUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setDocuments([]);
    setResult('');
    setVisualData({});
    setVisualAdjustments({});
    setDistillType('Executive');
    setViewMode('text');
  };

  const runDistillation = async () => {
    if (documents.length === 0) return;
    setIsProcessing(true);
    setResult('');
    setVisualData({});
    setVisualAdjustments({});
    setCurrentSlide(0);

    try {
      let finalResult = '';
      if (distillType === 'Poster') {
        finalResult = await generateIllustration(documents, language);
        setViewMode('visual');
      } else {
        const modePrompt = t.prompts[distillType as keyof typeof t.prompts];
        finalResult = await generateSummary(documents, language, modelProvider, modePrompt);
        if (['PPT', 'SWOT', 'Mindmap', 'Infographic'].includes(distillType)) setViewMode('visual');
        else setViewMode('text');
      }

      setResult(finalResult);

      // Create or Update Session in History
      const newSession: DistillSession = {
        id: currentSessionId || Math.random().toString(36).substr(2, 9),
        title: currentSession?.title || documents[0]?.name || 'Untitled Analysis',
        documents: documents,
        result: finalResult,
        type: distillType,
        visualData: {},
        visualAdjustments: {},
        timestamp: Date.now(),
        config: {
          logoUrl,
          themeColor: selectedTheme.id,
          themeName: selectedTheme.text
        }
      };

      if (currentSessionId) {
        setHistory(prev => prev.map(s => s.id === currentSessionId ? newSession : s));
      } else {
        setHistory(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
      }
    } catch (e) {
      console.error(e);
      setResult('Failed to distill content.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadImage = (url: string | null | undefined, name: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) startNewSession();
  };

  const startRename = (e: React.MouseEvent, s: DistillSession) => {
    e.stopPropagation();
    setEditingHistoryId(s.id);
    setEditTitle(s.title);
  };

  const saveRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingHistoryId) {
      setHistory(prev => prev.map(s => s.id === editingHistoryId ? { ...s, title: editTitle } : s));
      setEditingHistoryId(null);
    }
  };

  const currentVisual = useMemo(() => {
    const visualKey = distillType === 'PPT' ? `PPT_${currentSlide}` : distillType;
    return visualData[visualKey] || (distillType === 'Poster' ? result : null);
  }, [visualData, distillType, currentSlide, result]);

  const currentAdjustments = useMemo(() => {
    const visualKey = distillType === 'PPT' ? `PPT_${currentSlide}` : distillType;
    return visualAdjustments[visualKey] || DEFAULT_ADJUSTMENTS;
  }, [visualAdjustments, distillType, currentSlide]);

  const getFilterStyle = (adj: ImageAdjustments) => {
    return `brightness(${adj.brightness}) contrast(${adj.contrast}) saturate(${adj.saturate}) grayscale(${adj.grayscale}) sepia(${adj.sepia}) blur(${adj.blur}px)`;
  };

  const slideDeck = useMemo(() => {
    if (!result || distillType !== 'PPT') return [];
    return result.split(/\[Slide \d+:/i).filter(s => s.trim().length > 0).map(s => {
      const lines = s.split('\n');
      const title = lines[0].replace(']', '').trim();
      const body = lines.slice(1).join('\n');
      return { title, body };
    });
  }, [result, distillType]);

  const infographicPillars = useMemo(() => {
    if (!result || distillType !== 'Infographic') return [];
    // Extract [Pillar X: Title] Description
    const pillars: {title: string, content: string}[] = [];
    const matches = result.split(/\[Pillar \d+:/i).filter(s => s.trim().length > 0);
    matches.forEach(m => {
      const parts = m.split(']');
      if (parts.length >= 2) {
        pillars.push({
          title: parts[0].trim(),
          content: parts.slice(1).join(']').trim()
        });
      }
    });
    return pillars.slice(0, 4); // Limit to 4 for UI
  }, [result, distillType]);

  const updateAdjustments = (newAdj: Partial<ImageAdjustments>) => {
    const visualKey = distillType === 'PPT' ? `PPT_${currentSlide}` : distillType;
    const updated = { ...currentAdjustments, ...newAdj };
    const newVisualAdjustments = { ...visualAdjustments, [visualKey]: updated };
    setVisualAdjustments(newVisualAdjustments);
    if (currentSessionId) {
      setHistory(prev => prev.map(s => s.id === currentSessionId ? { ...s, visualAdjustments: newVisualAdjustments } : s));
    }
  };

  const handleReimagine = async () => {
    if (!currentVisual || !reimaginePrompt || isReimagining) return;
    setIsReimagining(true);
    try {
      const newImage = await reimagineVisual(currentVisual, reimaginePrompt);
      const visualKey = distillType === 'PPT' ? `PPT_${currentSlide}` : distillType;
      const newVisualData = { ...visualData, [visualKey]: newImage };
      setVisualData(newVisualData);
      setReimaginePrompt('');
      if (currentSessionId) {
        setHistory(prev => prev.map(s => s.id === currentSessionId ? { ...s, visualData: newVisualData } : s));
      }
    } catch (e) {
      console.error("Re-imagine failed", e);
    } finally {
      setIsReimagining(false);
    }
  };

  const renderSingleSlide = (slide: {title: string, body: string}, index: number, isMax = false) => {
    const visualKey = `PPT_${index}`;
    const slideImg = visualData[visualKey];
    const adj = visualAdjustments[visualKey] || DEFAULT_ADJUSTMENTS;

    return (
      <div className={`flex flex-col h-full w-full animate-in ${isMax ? 'fade-in zoom-in-95' : 'slide-in-from-bottom-12'} duration-700`}>
          <div className={`flex-1 ${isMax ? 'bg-black' : 'bg-slate-950'} rounded-[3rem] lg:rounded-[4rem] shadow-2xl relative overflow-hidden flex flex-col lg:flex-row border border-white/5`}>
             {/* Dynamic background effect */}
             {slideImg && <div className="absolute inset-0 opacity-20 blur-[100px] scale-125 transition-all duration-1000" style={{ backgroundColor: selectedTheme.color }}><img src={slideImg} style={{ filter: getFilterStyle(adj) }} className="w-full h-full object-cover mix-blend-overlay" /></div>}
             <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40"></div>
             
             {logoUrl && (
               <div className={`absolute ${isMax ? 'top-12 right-12' : 'top-8 right-8'} z-20 w-14 lg:w-16 h-14 lg:h-16 bg-white/10 backdrop-blur-2xl rounded-2xl p-3 border border-white/10 shadow-2xl`}>
                  <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" />
               </div>
             )}

             <div className={`${isMax ? 'lg:w-3/5' : 'lg:w-1/2'} p-8 lg:p-20 flex flex-col justify-center text-white relative z-10`}>
                <div className="space-y-8 lg:space-y-12">
                   <div className="flex items-center gap-4">
                      <div className="w-10 lg:w-14 h-1.5 lg:h-2 rounded-full shadow-lg" style={{ backgroundColor: selectedTheme.color, boxShadow: `0 4px 15px ${selectedTheme.color}60` }}></div>
                      <span className="text-[9px] lg:text-[11px] font-black uppercase tracking-[0.4em] drop-shadow-sm" style={{ color: selectedTheme.color }}>Strategic Module 0{index + 1}</span>
                   </div>
                   <h4 className={`${isMax ? 'text-5xl lg:text-7xl xl:text-8xl' : 'text-4xl lg:text-6xl'} font-black tracking-tighter leading-[1.1] mb-8 lg:mb-12 drop-shadow-2xl antialiased`}>{slide.title}</h4>
                   <div className={`prose prose-invert ${isMax ? 'prose-xl lg:prose-2xl xl:prose-3xl' : 'prose-lg lg:prose-xl'} font-medium italic text-white/90 leading-relaxed border-l-4 border-white/10 pl-8 lg:pl-12 py-3 backdrop-blur-sm bg-white/5 rounded-r-3xl`}>
                      <ReactMarkdown components={{ 
                        li: ({node, ...props}) => <li {...props} className="mb-4 last:mb-0 marker:text-white/40" />,
                        p: ({node, ...props}) => <p {...props} className="mb-0" />
                      }}>{slide.body}</ReactMarkdown>
                   </div>
                </div>
             </div>
             
             <div className={`${isMax ? 'lg:w-2/5' : 'lg:w-1/2'} p-8 lg:p-16 xl:p-20 flex items-center justify-center relative z-10`}>
                <div className={`w-full aspect-square bg-slate-900/50 backdrop-blur-md ${isMax ? 'rounded-[4rem] lg:rounded-[5rem]' : 'rounded-[2.5rem] lg:rounded-[3.5rem]'} shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 relative group ring-1 ring-white/20`}>
                   {slideImg ? (
                     <>
                       <img src={slideImg} style={{ filter: getFilterStyle(adj) }} className="w-full h-full object-cover transition-transform duration-[6s] ease-out group-hover:scale-105" alt="Concept Metaphor" />
                       {!isMax && (
                         <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                           <button 
                             onClick={() => setIsEditPanelOpen(true)}
                             className="p-4 bg-white/95 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.3)] rounded-2xl text-indigo-600 hover:scale-110 active:scale-95"
                             title={t.actions.edit}
                           >
                             <PencilIcon className="w-6 h-6" />
                           </button>
                           <button 
                             onClick={() => handleDownloadImage(slideImg, `slide_${index + 1}_${slide.title}`)}
                             className="p-4 bg-white/95 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.3)] rounded-2xl text-slate-900 hover:scale-110 active:scale-95"
                             title={t.actions.saveImage}
                           >
                             <DownloadIcon className="w-6 h-6" />
                           </button>
                         </div>
                       )}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                     </>
                   ) : (
                     <div className="h-full bg-slate-900/80 flex flex-col items-center justify-center p-12 text-center text-white/20">
                        <div className="relative">
                          <SparklesIcon className="w-16 lg:w-20 h-16 lg:h-20 animate-spin-slow mb-8 opacity-40" />
                          <div className="absolute inset-0 animate-ping opacity-20"><SparklesIcon className="w-full h-full" /></div>
                        </div>
                        <span className="text-[10px] lg:text-[12px] font-black tracking-[0.5em] uppercase animate-pulse">Synthesizing Visual...</span>
                     </div>
                   )}
                </div>
             </div>
          </div>
          {!isMax && (
            <div className="h-24 lg:h-32 flex items-center justify-between px-8 lg:px-16">
               <button onClick={() => setCurrentSlide(p => Math.max(0, p - 1))} disabled={currentSlide === 0} className="w-14 lg:w-16 h-14 lg:h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-800 shadow-xl hover:scale-110 hover:border-blue-400 active:scale-95 disabled:opacity-20 transition-all group">
                 <ArrowsPointingOutIcon className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
               </button>
               <div className="flex gap-2 lg:gap-3 px-8">
                 {slideDeck.map((_, i) => (
                   <button 
                    key={i} 
                    onClick={() => setCurrentSlide(i)}
                    className={`h-1.5 lg:h-2 rounded-full transition-all duration-700 hover:opacity-100 ${i === currentSlide ? 'w-12 lg:w-16 opacity-100' : 'w-1.5 lg:w-2 bg-slate-300 opacity-50'}`} 
                    style={{ backgroundColor: i === currentSlide ? selectedTheme.color : undefined }} 
                   />
                 ))}
               </div>
               <button onClick={() => setCurrentSlide(p => Math.min(slideDeck.length - 1, p + 1))} disabled={currentSlide === slideDeck.length - 1} className="w-14 lg:w-16 h-14 lg:h-16 bg-slate-950 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 disabled:opacity-20 transition-all group">
                 <ArrowsPointingOutIcon className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
               </button>
            </div>
          )}
      </div>
    );
  };

  const visualContent = useMemo(() => {
    if (!result) return null;

    if (distillType === 'Poster') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in fade-in duration-1000">
           <div className="bg-white p-4 rounded-[3.5rem] shadow-2xl border border-slate-100 max-w-2xl w-full aspect-square overflow-hidden group relative">
              <img src={result} style={{ filter: getFilterStyle(currentAdjustments) }} className="w-full h-full object-cover rounded-[2.8rem] transition-transform duration-1000 group-hover:scale-105" alt="Poster" />
              <div className="absolute bottom-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
                <button 
                    onClick={() => setIsEditPanelOpen(true)}
                    className="p-4 bg-white/90 backdrop-blur shadow-2xl rounded-2xl text-indigo-600 hover:scale-110 active:scale-95"
                    title={t.actions.edit}
                >
                    <PencilIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={() => handleDownloadImage(result, `poster_${currentSession?.title || 'analysis'}`)}
                    className="p-4 bg-white/90 backdrop-blur shadow-2xl rounded-2xl text-slate-800 hover:scale-110 active:scale-95 transition-all"
                    title={t.actions.saveImage}
                >
                    <DownloadIcon className="w-6 h-6" />
                </button>
              </div>
           </div>
           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 italic">Nano Banana Vision Card</span>
        </div>
      );
    }

    if (distillType === 'PPT') {
      const slide = slideDeck[currentSlide];
      if (!slide) return null;
      return renderSingleSlide(slide, currentSlide);
    }

    if (distillType === 'Infographic') {
      return (
        <div className="h-full w-full max-w-6xl mx-auto flex items-center justify-center relative p-8 animate-in zoom-in-95 duration-1000">
           {currentVisual && (
             <div className="absolute inset-0 opacity-10 blur-3xl scale-125 pointer-events-none">
               <img src={currentVisual} style={{ filter: getFilterStyle(currentAdjustments) }} className="w-full h-full object-cover" />
             </div>
           )}
           <div className="relative w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 z-10">
              {infographicPillars.map((pillar, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-2xl border border-slate-200 p-8 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 flex flex-col group h-full">
                  <div className="w-14 h-14 rounded-2xl mb-6 flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: selectedTheme.color }}>
                     <span className="text-xl font-black">0{i+1}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 mb-4 tracking-tighter leading-tight">{pillar.title}</h4>
                  <div className="flex-1 prose prose-slate prose-sm text-slate-500 font-medium italic leading-relaxed">
                    <ReactMarkdown>{pillar.content}</ReactMarkdown>
                  </div>
                  <div className="w-8 h-1 rounded-full mt-6 opacity-30 group-hover:w-16 transition-all" style={{ backgroundColor: selectedTheme.color }}></div>
                </div>
              ))}
              {infographicPillars.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic">No pillars found. Check format.</div>}
           </div>
           <div className="absolute top-10 right-10 z-20">
              <button 
                onClick={() => setIsEditPanelOpen(true)}
                className="p-4 bg-white/95 backdrop-blur shadow-xl rounded-2xl text-indigo-600 hover:scale-110 active:scale-95 border border-slate-200"
              >
                <PencilIcon className="w-6 h-6" />
              </button>
           </div>
        </div>
      );
    }

    if (distillType === 'SWOT') {
       const sections = {
        S: result.match(/\[(Strengths|优势)\]([\s\S]*?)(?=\[|$)/i)?.[2] || '',
        W: result.match(/\[(Weaknesses|劣势)\]([\s\S]*?)(?=\[|$)/i)?.[2] || '',
        O: result.match(/\[(Opportunities|机会)\]([\s\S]*?)(?=\[|$)/i)?.[2] || '',
        T: result.match(/\[(Threats|威胁)\]([\s\S]*?)(?=\[|$)/i)?.[2] || ''
      };
      return (
        <div className="h-full w-full max-w-6xl mx-auto flex items-center justify-center relative p-8 animate-in zoom-in-95 duration-1000">
           {currentVisual && (
             <div className="absolute inset-0 opacity-10 blur-3xl scale-125 pointer-events-none">
               <img src={currentVisual} style={{ filter: getFilterStyle(currentAdjustments) }} className="w-full h-full object-cover" />
             </div>
           )}
           <div className="relative w-full aspect-video grid grid-cols-2 gap-8 z-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-slate-900 border-[10px] border-white shadow-2xl rounded-full z-20 flex items-center justify-center text-white">
                 <span className="text-4xl font-black italic tracking-tighter">SWOT</span>
              </div>
              {[
                { id: 'S', color: 'bg-emerald-50/80 border-emerald-100 text-emerald-900', label: 'Strengths', icon: <SparklesIcon /> },
                { id: 'W', color: 'bg-rose-50/80 border-rose-100 text-rose-900', label: 'Weaknesses', icon: <XMarkIcon /> },
                { id: 'O', color: 'bg-blue-50/80 border-blue-100 text-blue-900', label: 'Opportunities', icon: <BoltIcon /> },
                { id: 'T', color: 'bg-amber-50/80 border-amber-100 text-amber-900', label: 'Threats', icon: <ExclamationIcon /> }
              ].map(box => (
                <div key={box.id} className={`${box.color} p-12 border-2 rounded-[4rem] backdrop-blur-2xl shadow-xl flex flex-col group transition-all hover:scale-[1.02]`}>
                   <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-800">{box.icon}</div>
                      <h4 className="text-2xl font-black uppercase tracking-tight opacity-80">{box.label}</h4>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar prose prose-slate prose-xl font-bold italic opacity-70 leading-relaxed">
                      <ReactMarkdown>{sections[box.id as keyof typeof sections]}</ReactMarkdown>
                   </div>
                </div>
              ))}
           </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700">
         <div className="lg:w-2/5 flex flex-col gap-6">
            <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 p-3 aspect-[4/3] overflow-hidden group relative">
               {currentVisual ? (
                 <>
                   <img src={currentVisual} style={{ filter: getFilterStyle(currentAdjustments) }} className="w-full h-full object-cover rounded-[2.8rem] transition-transform duration-[6s] group-hover:scale-110" alt="Summary Visual" />
                   <div className="absolute bottom-8 right-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500">
                     <button 
                        onClick={() => setIsEditPanelOpen(true)}
                        className="p-3 bg-white/90 backdrop-blur shadow-2xl rounded-xl text-indigo-600 hover:scale-110 active:scale-95"
                        title={t.actions.edit}
                     >
                        <PencilIcon className="w-5 h-5" />
                     </button>
                     <button 
                        onClick={() => handleDownloadImage(currentVisual, `${distillType}_visual`)}
                        className="p-3 bg-white/90 backdrop-blur shadow-2xl rounded-xl text-slate-800 hover:scale-110 active:scale-95"
                        title={t.actions.saveImage}
                     >
                        <DownloadIcon className="w-5 h-5" />
                     </button>
                   </div>
                 </>
               ) : (
                 <div className="h-full bg-slate-50 flex flex-col items-center justify-center text-slate-300 gap-6 rounded-[2.8rem]">
                    <InformationCircleIcon className="w-12 h-12 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Generating Insight Metaphor...</span>
                 </div>
               )}
            </div>
            <div className="bg-white/50 backdrop-blur-md p-10 rounded-[3rem] border border-white">
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-2 h-10 rounded-full" style={{ backgroundColor: selectedTheme.color }}></div>
                  <h4 className="text-xl font-black uppercase tracking-tighter text-slate-800">{distillType} Metric</h4>
               </div>
               <p className="text-xs font-bold text-slate-400 italic leading-relaxed">基于 Nano Banana 模型深度解析生成的视觉隐喻，辅助直观理解核心战略意图。</p>
            </div>
         </div>
         <div className="lg:w-3/5 bg-white rounded-[4rem] shadow-2xl border border-slate-100 p-16 overflow-y-auto custom-scrollbar">
            <div className="prose prose-slate prose-xl max-w-none font-medium leading-[2]">
               <ReactMarkdown>{result}</ReactMarkdown>
            </div>
         </div>
      </div>
    );
  }, [result, distillType, currentSlide, currentVisual, currentAdjustments, language, selectedTheme, logoUrl, currentSession, slideDeck, infographicPillars]);

  return (
    <div className="flex h-full bg-slate-100 gap-4 p-4 overflow-hidden relative">
      {/* Icon Sidebar & History Drawer Trigger */}
      <div className="w-24 bg-white rounded-[3rem] shadow-sm border border-slate-200 flex flex-col py-8 items-center gap-4 flex-shrink-0 overflow-y-auto custom-scrollbar">
         <div className="p-4 bg-emerald-600 text-white rounded-[1.5rem] shadow-lg mb-4"><NewspaperIcon className="w-6 h-6" /></div>
         
         <div className="flex-1 w-full space-y-3 px-3">
            {Object.entries(t.options).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => setDistillType(key)}
                className={`w-full flex flex-col items-center justify-center p-4 rounded-[1.8rem] transition-all border group ${
                  distillType === key ? 'border-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-slate-50 border-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
                style={{ backgroundColor: distillType === key ? selectedTheme.color : undefined }}
                title={(opt as any).label}
              >
                <div className="scale-125 mb-2">{(opt as any).icon}</div>
                <span className="text-[7px] font-black uppercase tracking-widest text-center truncate w-full">{(opt as any).label}</span>
              </button>
            ))}

            {/* Slide Customization Options */}
            {distillType === 'PPT' && (
              <div className="pt-4 border-t border-slate-100 mt-2 space-y-3">
                 <button 
                  onClick={() => logoInputRef.current?.click()}
                  className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-all border ${logoUrl ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'bg-slate-50 border-slate-50 text-slate-300 hover:bg-slate-100'}`}
                  title={t.slideConfig.logo}
                 >
                   <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                   {logoUrl ? <img src={logoUrl} className="w-6 h-6 object-contain rounded-sm" /> : <CameraIcon className="w-6 h-6" />}
                 </button>
                 
                 {logoUrl && (
                   <button onClick={() => setLogoUrl(undefined)} className="w-full text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-600">{t.slideConfig.removeLogo}</button>
                 )}
              </div>
            )}
         </div>

         <div className="pt-4 border-t border-slate-100 w-full px-4 flex flex-col gap-4">
            <button onClick={() => setShowHistory(!showHistory)} className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-all ${showHistory ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`} title={t.historyTitle}><ClockIcon className="w-6 h-6" /></button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-square bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 hover:bg-emerald-50 hover:text-emerald-500 transition-all" title={t.uploadZone}>
               {isUploading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span> : <UploadIcon className="w-6 h-6" />}
            </button>
         </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="w-72 bg-white rounded-[3rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-left duration-500">
           <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2"><ClockIcon className="w-4 h-4" /> {t.historyTitle}</h3>
              <button onClick={startNewSession} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all" title={t.btnNew}><PlusIcon className="w-4 h-4" /></button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              
              {/* Color Theme Selector */}
              {['PPT', 'Infographic'].includes(distillType) && (
                <div className="p-4 mb-4 bg-slate-50 rounded-3xl border border-slate-100">
                   <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.slideConfig.theme}</h4>
                   <div className="grid grid-cols-6 gap-2">
                      {THEMES.map(th => (
                        <button 
                          key={th.id}
                          onClick={() => setSelectedTheme(th)}
                          className={`w-full aspect-square rounded-full border-2 transition-all ${selectedTheme.id === th.id ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: th.color }}
                          title={th.name}
                        />
                      ))}
                   </div>
                </div>
              )}

              {history.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-300 italic text-[10px] uppercase tracking-widest">{t.noHistory}</div>
              ) : (
                history.map(s => (
                  <div key={s.id} onClick={() => setCurrentSessionId(s.id)} className={`p-5 rounded-[2rem] border transition-all cursor-pointer group ${currentSessionId === s.id ? 'text-white shadow-lg' : 'bg-slate-50 border-slate-50 hover:bg-slate-100'}`} style={{ backgroundColor: currentSessionId === s.id ? (THEMES.find(th => th.id === s.config?.themeColor)?.color || selectedTheme.color) : undefined }}>
                    <div className="flex justify-between items-start mb-2">
                       {editingHistoryId === s.id ? (
                          <div className="flex-1 flex items-center gap-2">
                             <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onClick={e => e.stopPropagation()} className="w-full text-[10px] bg-white text-slate-900 px-2 py-1 rounded outline-none border border-blue-400" />
                             <button onClick={saveRename} className="text-white"><CheckIcon className="w-4 h-4" /></button>
                          </div>
                       ) : (
                          <span className="text-[11px] font-black truncate flex-1 tracking-tight pr-2">{s.title}</span>
                       )}
                       <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => startRename(e, s)} className="p-1 hover:text-white"><PencilIcon className="w-3 h-3" /></button>
                          <button onClick={(e) => deleteHistory(e, s.id)} className="p-1 hover:text-white"><TrashIcon className="w-3 h-3" /></button>
                       </div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                       <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${currentSessionId === s.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>{s.type}</span>
                       <span className="text-[8px] opacity-60 font-medium">{new Date(s.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col bg-white rounded-[3.5rem] shadow-sm border border-slate-200 overflow-hidden relative">
         <div className="px-12 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
               <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3"><EyeIcon className="w-4 h-4" /> {t.resultTitle}</h3>
               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">{t.subtitle}</p>
            </div>
            <div className="flex items-center gap-4">
               {documents.length > 0 && (
                 <button onClick={runDistillation} disabled={isProcessing} className="bg-slate-950 text-white px-10 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-20 flex items-center gap-3">
                   {isProcessing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <SparklesIcon className="w-4 h-4" />}
                   {isProcessing ? t.distilling : t.btnDistill}
                 </button>
               )}
               {result && (
                 <div className="flex items-center gap-3">
                    <div className="bg-slate-200/50 p-1.5 rounded-2xl flex border border-slate-200">
                       <button onClick={() => setViewMode('text')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.viewMode.text}</button>
                       <button onClick={() => setViewMode('visual')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'visual' ? 'bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} style={{ color: viewMode === 'visual' ? selectedTheme.color : undefined }}>{t.viewMode.visual}</button>
                    </div>
                    {viewMode === 'visual' && distillType === 'PPT' && (
                      <button onClick={() => setIsPresentationOpen(true)} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200">
                        <ArrowsPointingOutIcon className="w-3 h-3" /> {t.viewMode.present}
                      </button>
                    )}
                 </div>
               )}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-8 lg:p-12 xl:p-16 custom-scrollbar">
            {isProcessing ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <div className="w-16 h-16 border-4 border-emerald-50 border-t-emerald-600 rounded-full animate-spin mb-6"></div>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] animate-pulse">{t.distilling}</p>
               </div>
            ) : result ? (
               <div className="h-full">
                  {viewMode === 'visual' ? visualContent : (
                    <div className="prose prose-slate prose-xl max-w-4xl mx-auto font-medium leading-[2.2] animate-in fade-in duration-500">
                       <ReactMarkdown>{result}</ReactMarkdown>
                    </div>
                  )}
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-200 italic opacity-40 text-center p-20">
                  <div className="p-10 bg-slate-50 rounded-full mb-8"><NewspaperIcon className="w-24 h-24" /></div>
                  <p className="text-[12px] font-black uppercase tracking-[0.5em] mb-12">{t.noDocs}</p>
                  <div className="flex flex-wrap gap-4 justify-center max-w-lg">
                     {documents.map(d => <div key={d.id} className="px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.name}</div>)}
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* Image Editing Panel Drawer */}
      {isEditPanelOpen && currentVisual && (
          <div className="fixed inset-y-0 right-0 w-80 bg-white/90 backdrop-blur-2xl shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[1100] border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-500">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-black text-slate-800 text-sm tracking-tight uppercase"><PencilIcon className="inline mr-2" /> {t.editVisual.title}</h3>
                  <button onClick={() => setIsEditPanelOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><XMarkIcon /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  {/* CSS Filters */}
                  <div className="space-y-6">
                      <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Adjustments</h4>
                          <button onClick={() => updateAdjustments(DEFAULT_ADJUSTMENTS)} className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">{t.editVisual.reset}</button>
                      </div>
                      
                      {[
                        { key: 'brightness', label: t.editVisual.brightness, min: 0.5, max: 2, step: 0.1 },
                        { key: 'contrast', label: t.editVisual.contrast, min: 0.5, max: 2, step: 0.1 },
                        { key: 'saturate', label: t.editVisual.saturate, min: 0, max: 3, step: 0.1 },
                        { key: 'grayscale', label: t.editVisual.grayscale, min: 0, max: 1, step: 0.1 },
                        { key: 'sepia', label: t.editVisual.sepia, min: 0, max: 1, step: 0.1 },
                        { key: 'blur', label: t.editVisual.blur, min: 0, max: 10, step: 1 },
                      ].map(slider => (
                        <div key={slider.key} className="space-y-2">
                           <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                               <span>{slider.label}</span>
                               <span className="text-slate-400">{currentAdjustments[slider.key as keyof ImageAdjustments]}</span>
                           </div>
                           <input 
                             type="range" 
                             min={slider.min} 
                             max={slider.max} 
                             step={slider.step} 
                             value={currentAdjustments[slider.key as keyof ImageAdjustments]} 
                             onChange={(e) => updateAdjustments({ [slider.key]: parseFloat(e.target.value) })}
                             className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                           />
                        </div>
                      ))}
                  </div>

                  {/* AI Reimagine */}
                  <div className="space-y-4 pt-8 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                          <SparklesIcon className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.editVisual.aiReimagine}</h4>
                      </div>
                      <textarea 
                        value={reimaginePrompt}
                        onChange={(e) => setReimaginePrompt(e.target.value)}
                        placeholder={t.editVisual.reimaginePlaceholder}
                        className="w-full h-24 p-4 text-xs bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 resize-none font-medium text-slate-600"
                      />
                      <button 
                        onClick={handleReimagine}
                        disabled={!reimaginePrompt || isReimagining}
                        className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                      >
                         {isReimagining ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <SaveIcon className="w-4 h-4" />}
                         {isReimagining ? t.editVisual.processing : t.editVisual.reimagineBtn}
                      </button>
                  </div>
              </div>

              <div className="p-8 border-t border-slate-100">
                   <button onClick={() => setIsEditPanelOpen(false)} className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">{t.editVisual.close}</button>
              </div>
          </div>
      )}

      {/* Presentation Mode Modal */}
      {isPresentationOpen && slideDeck.length > 0 && (
        <div className="fixed inset-0 z-[1200] bg-black flex flex-col animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
           <div className="absolute top-8 left-8 right-8 z-[1201] flex justify-between items-center opacity-0 hover:opacity-100 transition-opacity duration-300">
              <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
                 <h2 className="text-white text-xs font-black uppercase tracking-widest">{currentSession?.title}</h2>
                 <span className="w-px h-4 bg-white/20"></span>
                 <span className="text-white/60 text-[10px] font-black">{currentSlide + 1} / {slideDeck.length}</span>
              </div>
              <div className="flex gap-4">
                 <button 
                    onClick={() => setIsEditPanelOpen(true)} 
                    className="bg-white/10 backdrop-blur-md text-white p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-all"
                    title={t.actions.edit}
                 >
                    <PencilIcon className="w-6 h-6" />
                 </button>
                 <button onClick={() => handleDownloadImage(visualData[`PPT_${currentSlide}`], `slide_${currentSlide + 1}`)} className="bg-white/10 backdrop-blur-md text-white p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-all"><DownloadIcon className="w-6 h-6" /></button>
                 <button onClick={() => setIsPresentationOpen(false)} className="bg-white/10 backdrop-blur-md text-white px-6 py-4 rounded-2xl border border-white/10 font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:border-red-500 transition-all">{t.actions.close}</button>
              </div>
           </div>

           <div className="flex-1 p-6 lg:p-12 xl:p-20 relative flex items-center justify-center">
              {renderSingleSlide(slideDeck[currentSlide], currentSlide, true)}
              
              {/* Invisible Nav Overlays for Click */}
              {!isEditPanelOpen && (
                <>
                    <div onClick={() => setCurrentSlide(p => Math.max(0, p - 1))} className="absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize z-[1202]"></div>
                    <div onClick={() => setCurrentSlide(p => Math.min(slideDeck.length - 1, p + 1))} className="absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize z-[1202]"></div>
                </>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default ContentDistiller;
