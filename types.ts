
export interface DataPoint {
  [key: string]: any;
}

export interface Dataset {
  name: string;
  headers: string[];
  rows: DataPoint[];
  summary?: string;
}

export interface ChatMessage {
  role: 'user' | 'sage';
  content: string;
  timestamp: Date;
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  finding?: string;
  chartData?: any;
  chartType?: 'bar' | 'line' | 'pie' | 'scatter';
}

export interface AnalysisState {
  isProcessing: boolean;
  stage: 'idle' | 'cleaning' | 'hypothesizing' | 'analyzing' | 'reporting';
  logs: string[];
  hypotheses: Hypothesis[];
  summary: string;
  chat: ChatMessage[];
  isAudioPlaying: boolean;
}
