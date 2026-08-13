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
      const passed = stdev >= this.primaryThreshold;

      return {
        checkName: this.name,
        passed,
        score: Math.round(stdev * 100) / 100,
        details: {
          method: 'Laplacian Variance (3x3 Kernel)',
          laplacianStdev: Math.round(stdev * 100) / 100,
          threshold: this.primaryThreshold,
          assessment: passed ? 'sharp' : 'blurry',
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
        const passed = stdev >= 15.0;

        return {
          checkName: this.name,
          passed,
          score: Math.round(stdev * 100) / 100,
          details: {
            method: 'Fallback Expanded Laplacian (5x5 Kernel)',
            laplacianStdev: Math.round(stdev * 100) / 100,
            threshold: 15.0,
            assessment: passed ? 'sharp' : 'blurry',
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
