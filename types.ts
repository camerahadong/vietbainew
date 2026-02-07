export enum StepStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export type OutputLanguage = 'vi' | 'en';

export interface WpConfig {
  url: string;
  username: string;
  appPassword: string;
}

export interface StepData {
  step2_ideation: string;
  step3_outline: string;
  step4_article: string;
}

export interface HistoryItem {
  id: string;
  keyword: string;
  content: string;
  timestamp: number;
  language?: OutputLanguage;
}

export enum AppStep {
  INPUT = 1,
  IDEATION = 2,
  OUTLINE = 3,
  WRITING = 4,
  PUBLISH = 5
}