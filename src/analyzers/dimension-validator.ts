import type { Analyzer, AnalyzerResult, ImageMetadataInput } from './types';

export class DimensionValidator implements Analyzer {
  name = 'dimension_validation';
  private minWidth = 200;
  private minHeight = 200;
  private maxWidth = 10000;
  private maxHeight = 10000;
  private minAspectRatio = 0.2; // 1:5
  private maxAspectRatio = 5.0; // 5:1

  async analyze(
    _imagePath: string,
    _imageBuffer: Buffer,
    metadata: ImageMetadataInput
  ): Promise<AnalyzerResult> {
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const aspectRatio = height > 0 ? width / height : 0;
    const megaPixels = Math.round((width * height) / 100000) / 10;

    const meetsMinimum = width >= this.minWidth && height >= this.minHeight;
    const meetsMaximum = width <= this.maxWidth && height <= this.maxHeight;
    const validAspectRatio = aspectRatio >= this.minAspectRatio && aspectRatio <= this.maxAspectRatio;

    const passed = meetsMinimum && meetsMaximum && validAspectRatio;
    const resultStatus = passed ? 'NO_ISSUE_DETECTED' : 'ISSUE_DETECTED';

    return Promise.resolve({
      checkName: this.name,
      resultStatus,
      passed,
      score: megaPixels,
      details: {
        width,
        height,
        megaPixels,
        aspectRatio: Math.round(aspectRatio * 100) / 100,
        meetsMinimum,
        meetsMaximum,
        validAspectRatio,
        allowedBounds: {
          minResolution: `${this.minWidth}x${this.minHeight}`,
          maxResolution: `${this.maxWidth}x${this.maxHeight}`,
          aspectRatioRange: `${this.minAspectRatio} - ${this.maxAspectRatio}`,
        },
        evidence: passed
          ? `Image resolution ${width}x${height} (${megaPixels} MP) meets pipeline dimension bounds.`
          : `Image resolution ${width}x${height} outside allowed pipeline resolution bounds.`,
      },
    });
  }
}
