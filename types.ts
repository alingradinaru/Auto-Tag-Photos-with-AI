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
}

export type ProcessingOptions = {
  language: string;
  maxKeywords: number;
};

export const CATEGORIES = [
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