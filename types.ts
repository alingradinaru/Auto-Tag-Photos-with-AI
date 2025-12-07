export interface PhotoMetadata {
  title: string;
  description: string;
  keywords: string[];
  category: string;
  qualityAnalysis?: {
    score: number;
    issues: string[];
  };
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ProcessingStatus;
  data?: PhotoMetadata;
  error?: string;
  // History for Undo/Redo
  history?: PhotoMetadata[];
  historyIndex?: number;
}

export type ProcessingOptions = {
  language: string;
  maxKeywords: number;
};

export const INITIAL_CATEGORIES = [
  'Backgrounds',
  'Textures',
  'Patterns',
  'Nature',
  'People',
  'Business',
  'Technology',
  'Food',
  'Interiors',
  'Architecture',
  'Abstract',
  'Animals',
  'Travel',
  'Illustrations'
];