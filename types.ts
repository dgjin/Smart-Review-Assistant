
export type Language = 'zh' | 'en';

export type ModelProvider = 'Gemini' | 'DeepSeek';

export interface Rule {
  id: string;
  title: string;
  content: string;
  category: 'Legal' | 'Financial' | 'Compliance' | 'Technical';
  active: boolean;
}

export interface ReviewDocument {
  id: string;
  name: string;
  content: string; // Text string OR Base64 string for PDFs
  extractedText?: string; // Plain text extracted from PDF for non-multimodal models
  type: 'pdf' | 'docx' | 'txt'; 
  mimeType: string;
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
