import sharp from 'sharp';
import type { Analyzer, AnalyzerResult, ImageMetadataInput } from './types';

export class BrightnessAnalyzer implements Analyzer {
  name = 'brightness_analysis';
  private minThreshold = 40;
  private maxThreshold = 220;

  async analyze(
    _imagePath: string,
    imageBuffer: Buffer,
    _metadata: ImageMetadataInput
  ): Promise<AnalyzerResult> {
    try {
      // Primary Method: Sharp Greyscale Stats
      const stats = await sharp(imageBuffer).greyscale().stats();
      const meanBrightness = stats.channels[0].mean;

      let assessment: 'ACCEPTABLE' | 'TOO_DARK' | 'OVEREXPOSED' = 'ACCEPTABLE';
      let passed = true;

      if (meanBrightness < this.minThreshold) {
        assessment = 'TOO_DARK';
        passed = false;
      } else if (meanBrightness > this.maxThreshold) {
        assessment = 'OVEREXPOSED';
        passed = false;
      }

      const resultStatus = passed ? 'NO_ISSUE_DETECTED' : 'ISSUE_DETECTED';

      return {
        checkName: this.name,
        resultStatus,
        passed,
        score: Math.round(meanBrightness * 100) / 100,
        details: {
          meanBrightness: Math.round(meanBrightness * 100) / 100,
          assessment,
          range: {
            min: this.minThreshold,
            max: this.maxThreshold,
          },
          method: 'Greyscale Mean Luminance',
          evidence: `Mean Luminance Y = ${meanBrightness.toFixed(2)} (Acceptable Range: ${this.minThreshold} - ${this.maxThreshold})`,
        },
      };
    } catch {
      // Fallback Method: Raw RGB Buffer Sampling
      const { data } = await sharp(imageBuffer)
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      let sum = 0;
      for (let i = 0; i < data.length; i += 3) {
        // Relative luminance formula: 0.2126 R + 0.7152 G + 0.0722 B
        const r = data[i];
        const g = data[i + 1] || r;
        const b = data[i + 2] || r;
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      const meanBrightness = sum / (data.length / 3);
      const passed = meanBrightness >= this.minThreshold && meanBrightness <= this.maxThreshold;
      const resultStatus = passed ? 'NO_ISSUE_DETECTED' : 'ISSUE_DETECTED';
      const assessment = meanBrightness < this.minThreshold ? 'TOO_DARK' : meanBrightness > this.maxThreshold ? 'OVEREXPOSED' : 'ACCEPTABLE';

      return {
        checkName: this.name,
        resultStatus,
        passed,
        score: Math.round(meanBrightness * 100) / 100,
        details: {
          meanBrightness: Math.round(meanBrightness * 100) / 100,
          assessment,
          range: { min: this.minThreshold, max: this.maxThreshold },
          method: 'RGB Buffer Luminance Sampling (Fallback)',
          evidence: `Mean Fallback Luminance Y = ${meanBrightness.toFixed(2)} (Acceptable Range: ${this.minThreshold} - ${this.maxThreshold})`,
          fallbackExecuted: true,
        },
      };
    }
  }
}
