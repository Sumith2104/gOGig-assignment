export interface AnalyzerResult {
  checkName: string;
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
