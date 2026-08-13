export type ResultStatus =
  | 'NO_ISSUE_DETECTED'
  | 'ISSUE_DETECTED'
  | 'UNABLE_TO_DETERMINE'
  | 'REVIEW_REQUIRED'
  | 'ANALYZER_ERROR';

export interface AnalyzerResult {
  checkName: string;
  resultStatus: ResultStatus;
  passed: boolean;
  score: number | null;
  details: Record<string, unknown>;
}

export interface ImageMetadataInput {
  width: number;
  height: number;
  format: string;
  fileSize?: number;
  mimeType?: string;
}

export interface Analyzer {
  name: string;
  analyze(
    imagePath: string,
    imageBuffer: Buffer,
    metadata: ImageMetadataInput
  ): Promise<AnalyzerResult>;
}
