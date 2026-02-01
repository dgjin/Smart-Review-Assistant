
export type Language = 'zh' | 'en';

export type ModelProvider = 'Gemini' | 'DeepSeek' | 'MiniMax';

export interface AISettings {
  deepseekKey: string;
  deepseekBaseUrl: string;
  minimaxKey: string;
}

export interface Rule {
  id: string;
  title: string;
  content: string;
  category: 'Legal' | 'Financial' | 'Compliance' | 'Technical';
  active: boolean;
}

export interface ReferenceDocument {
  id: string;
  title: string;
  content: string;
  type: 'pdf' | 'docx' | 'txt';
  category: 'HR' | 'Financial' | 'Legal' | 'Operational' | 'Compliance';
  active: boolean;
  tags?: string[];
}

export interface DocumentVersion {
  id: string;
  timestamp: number;
  name: string;
  content: string;
  extractedText?: string;
}

export interface ReviewDocument {
  id: string;
  name: string;
  content: string; // Text string OR Base64 string for PDFs
  extractedText?: string; // Plain text extracted from PDF for non-multimodal models
  type: 'pdf' | 'docx' | 'txt'; 
  mimeType: string;
  versions?: DocumentVersion[]; // Snapshot history
}

export interface ExtractedInfo {
  field: string;
  value: string;
  sourceContext: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface ReviewSession {
  id: string;
  title: string;
  status: 'Draft' | 'Processing' | 'Completed';
  documents: ReviewDocument[];
  extractedData: ExtractedInfo[];
  summary: string;
  summaryPrompt: string;
  opinion: string;
  createdAt: number;
}

export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  blur: number;
}

export interface DistillSession {
  id: string;
  title: string;
  documents: ReviewDocument[];
  result: string;
  type: string; // Executive, Keywords, etc.
  visualData: Record<string, string>; // Cache for AI generated images
  visualAdjustments?: Record<string, ImageAdjustments>; // CSS filter adjustments
  timestamp: number;
  config?: {
    logoUrl?: string;
    themeColor?: string;
    themeName?: string;
  };
}
