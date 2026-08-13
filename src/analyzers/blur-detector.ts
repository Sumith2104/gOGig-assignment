import sharp from 'sharp';
import type { Analyzer, AnalyzerResult, ImageMetadataInput } from './types';

export class BlurDetector implements Analyzer {
  name = 'blur_detection';
  private primaryThreshold = 10.0; // Standard deviation threshold for 3x3 Laplacian

  async analyze(
    imagePath: string,
    imageBuffer: Buffer,
    _metadata: ImageMetadataInput
  ): Promise<AnalyzerResult> {
    try {
      // Primary Method: 3x3 Laplacian Kernel Convolution
      const { data, info } = await sharp(imageBuffer)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const stats = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 1,
        },
      }).stats();

      const stdev = stats.channels[0].stdev;
      const variance = stdev * stdev;
      const passed = stdev >= this.primaryThreshold;
      const resultStatus = passed ? 'NO_ISSUE_DETECTED' : 'ISSUE_DETECTED';

      return {
        checkName: this.name,
        resultStatus,
        passed,
        score: Math.round(stdev * 100) / 100,
        details: {
          method: '3x3 Laplacian Convolution',
          laplacianStdev: Math.round(stdev * 100) / 100,
          laplacianVariance: Math.round(variance * 100) / 100,
          thresholdStdev: this.primaryThreshold,
          assessment: passed ? 'SHARP' : 'MODERATELY_BLURRY',
          evidence: `Measured Laplacian Standard Deviation σ = ${stdev.toFixed(2)} (Threshold: ${this.primaryThreshold})`,
        },
      };
    } catch (primaryError) {
      // Fallback Method: 5x5 Expanded Laplacian Kernel
      try {
        const { data, info } = await sharp(imageBuffer)
          .greyscale()
          .convolve({
            width: 5,
            height: 5,
            kernel: [
              0, 0, -1, 0, 0,
              0, -1, -2, -1, 0,
              -1, -2, 16, -2, -1,
              0, -1, -2, -1, 0,
              0, 0, -1, 0, 0,
            ],
          })
          .raw()
          .toBuffer({ resolveWithObject: true });

        const stats = await sharp(data, {
          raw: {
            width: info.width,
            height: info.height,
            channels: 1,
          },
        }).stats();

        const stdev = stats.channels[0].stdev;
        const variance = stdev * stdev;
        const passed = stdev >= 15.0;
        const resultStatus = passed ? 'NO_ISSUE_DETECTED' : 'ISSUE_DETECTED';

        return {
          checkName: this.name,
          resultStatus,
          passed,
          score: Math.round(stdev * 100) / 100,
          details: {
            method: 'Fallback Expanded 5x5 Laplacian',
            laplacianStdev: Math.round(stdev * 100) / 100,
            laplacianVariance: Math.round(variance * 100) / 100,
            thresholdStdev: 15.0,
            assessment: passed ? 'SHARP' : 'MODERATELY_BLURRY',
            evidence: `Measured Fallback Laplacian Standard Deviation σ = ${stdev.toFixed(2)} (Threshold: 15.0)`,
            fallbackExecuted: true,
          },
        };
      } catch (fallbackError) {
        throw new Error(
          `Blur detection failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
      }
    }
  }
}
