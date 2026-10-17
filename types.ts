export interface RunOptions {
  limit?: number;
  offset?: number;
  includeBody?: boolean;
  unreadOnly?: boolean;
  reclassify?: boolean;
  execute?: boolean;
  trashThreshold?: number;
}

export interface WorkerResponse {
  ok?: boolean;
  command?: string;
  error?: string;
  message?: string;
  entries?: HistoryEntry[];
  recommendations?: EmailRecommendation[];
  [key: string]: unknown;
}

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  parsed: WorkerResponse | null;
}

export interface HistoryEntry {
  ts?: string;
  uid?: number;
  date?: string | null;
  messageId?: string;
  from?: string;
  subject?: string;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number | null;
  model?: string;
  action?: string;
  [key: string]: unknown;
}

export type MailDestination = 'trash' | 'archive';

export interface EmailRecommendation {
  uid: number;
  date: string | null;
  subject: string;
  from: string;
  confidence: number | null;
  recommendation: string;
  probabilities: Record<string, number>;
  action?: string;
}

declare global {
  interface Window {
    triage: {
      health(): Promise<CliResult>;
      config(): Promise<CliResult>;
      history(limit: number): Promise<CliResult>;
      run(options: RunOptions): Promise<CliResult>;
      move(uid: number, destination: MailDestination): Promise<CliResult>;
    };
  }
}
