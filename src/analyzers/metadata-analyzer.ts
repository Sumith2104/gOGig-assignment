import ExifReader from 'exifreader';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import type { Analyzer, AnalyzerResult, ImageMetadataInput } from './types';

export class MetadataAnalyzer implements Analyzer {
  name = 'metadata_analysis';

  private async scanVisualGpsWatermark(imageBuffer: Buffer): Promise<{ hasGps: boolean; latitude?: number; longitude?: number; rawGpsText?: string }> {
    let worker: any = null;

    const scanPromise = (async () => {
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 800;

      // Extract bottom 25% image overlay band (where GPS Map Camera stamp lives)
      const cropTop = Math.floor(height * 0.75);
      const cropHeight = Math.floor(height * 0.25);

      const overlayBuffer = await sharp(imageBuffer)
        .extract({ left: 0, top: cropTop, width, height: cropHeight })
        .greyscale()
        .resize(1000, undefined, { fit: 'inside' })
        .toBuffer();

      worker = await createWorker('eng');
      const res = await worker.recognize(overlayBuffer);
      await worker.terminate();

      const rawText = res.data.text || '';
      
      // Match Lat: 13.1059115 | Long: 80.2514811 or Lat 13.1059115 Long 80.2514811
      const latMatch = rawText.match(/LAT[:\s]*([0-9]{1,2}\.[0-9]{3,8})/i);
      const longMatch = rawText.match(/LONG[:\s]*([0-9]{1,3}\.[0-9]{3,8})/i);

      if (latMatch && longMatch) {
        const latitude = parseFloat(latMatch[1]);
        const longitude = parseFloat(longMatch[1]);
        return {
          hasGps: true,
          latitude,
          longitude,
          rawGpsText: `Lat: ${latitude} | Long: ${longitude}`,
        };
      }

      // Fallback coordinate search e.g. 13.1059115, 80.2514811
      const coordMatch = rawText.match(/([0-9]{1,2}\.[0-9]{4,8})\s*[,|\s]\s*([0-9]{1,3}\.[0-9]{4,8})/);
      if (coordMatch) {
        const latitude = parseFloat(coordMatch[1]);
        const longitude = parseFloat(coordMatch[2]);
        return {
          hasGps: true,
          latitude,
          longitude,
          rawGpsText: `Lat: ${latitude} | Long: ${longitude}`,
        };
      }

      return { hasGps: false };
    })();

    const timeoutPromise = new Promise<{ hasGps: boolean }>((resolve) =>
      setTimeout(() => {
        if (worker) {
          try { worker.terminate(); } catch {}
        }
        resolve({ hasGps: false });
      }, 3500)
    );

    return Promise.race([scanPromise, timeoutPromise]);
  }

  /**
   * Multi-factor Screenshot Detection Heuristics Engine
   */
  private detectScreenshotHeuristics(
    tags: Record<string, any>,
    width: number,
    height: number,
    format: string
  ): { isScreenshot: boolean; confidenceScore: number; indicators: string[] } {
    const indicators: string[] = [];
    let score = 0;

    const cameraMake = tags['Make']?.description;
    const cameraModel = tags['Model']?.description;
    const software = tags['Software']?.description;
    const fNumber = tags['FNumber']?.description;
    const iso = tags['ISOSpeedRatings']?.description;

    // 1. Missing EXIF Camera Hardware Metadata (Strong indicator for screenshots)
    if (!cameraMake && !cameraModel && !fNumber && !iso) {
      score += 0.40;
      indicators.push('EXIF camera hardware parameters missing (Make/Model/ISO/Aperture stripped)');
    }

    // 2. PNG Format Heuristic (iOS and Android screenshots default to PNG)
    if (format.toLowerCase() === 'png' && !cameraMake) {
      score += 0.20;
      indicators.push('Lossless PNG image format without camera metadata');
    }

    // 3. Aspect Ratio Heuristic (Standard Mobile / Desktop Screen Ratios: 19.5:9, 20:9, 16:9)
    if (width > 0 && height > 0) {
      const ratio = Math.max(width, height) / Math.min(width, height);
      const isScreenRatio = (
        Math.abs(ratio - 16 / 9) < 0.03 ||   // 1.777 (16:9 standard desktop/phone)
        Math.abs(ratio - 19.5 / 9) < 0.05 || // 2.166 (iPhone X-15 modern notch aspect)
        Math.abs(ratio - 20 / 9) < 0.05 ||   // 2.222 (Android tall screen aspect)
        Math.abs(ratio - 18 / 9) < 0.03      // 2.000 (18:9 screen aspect)
      );

      if (isScreenRatio && !cameraMake) {
        score += 0.25;
        indicators.push(`Exact mobile/desktop screen display aspect ratio detected (${ratio.toFixed(2)}:1)`);
      }
    }

    // 4. Software Tag Heuristic
    if (software && /screenshot|iOS|Android|System|Capture|Snipping/i.test(software)) {
      score += 0.35;
      indicators.push(`Software tag indicates screen capture engine: ${software}`);
    }

    const confidenceScore = Math.min(1.0, Math.round(score * 100) / 100);
    const isScreenshot = confidenceScore >= 0.50;

    return { isScreenshot, confidenceScore, indicators };
  }

  async analyze(
    _imagePath: string,
    imageBuffer: Buffer,
    inputMeta: ImageMetadataInput
  ): Promise<AnalyzerResult> {
    const anomalies: string[] = [];
    let cameraMake: string | null = null;
    let cameraModel: string | null = null;
    let dateTime: string | null = null;
    let software: string | null = null;
    let hasGps = false;
    let gpsSource: string = 'None';
    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      const tags = ExifReader.load(imageBuffer);

      if (tags['Make']) cameraMake = tags['Make'].description;
      if (tags['Model']) cameraModel = tags['Model'].description;
      if (tags['DateTimeOriginal']) dateTime = tags['DateTimeOriginal'].description;
      if (tags['Software']) software = tags['Software'].description;

      if (tags['GPSLatitude'] && tags['GPSLongitude']) {
        hasGps = true;
        gpsSource = 'EXIF Header Tags';
      }

      // Perform Visual GPS Watermark Scan if EXIF GPS is absent
      if (!hasGps) {
        const visualGps = await this.scanVisualGpsWatermark(imageBuffer);
        if (visualGps.hasGps) {
          hasGps = true;
          gpsSource = 'Visual Watermark Overlay (GPS Map Camera)';
          latitude = visualGps.latitude || null;
          longitude = visualGps.longitude || null;
        }
      }

      // Run Multi-Factor Screenshot Detection Heuristics
      const screenshotAnalysis = this.detectScreenshotHeuristics(
        tags,
        inputMeta.width,
        inputMeta.height,
        inputMeta.format
      );

      if (screenshotAnalysis.isScreenshot) {
        anomalies.push(`Screenshot detection heuristic triggered (Confidence: ${(screenshotAnalysis.confidenceScore * 100).toFixed(0)}%)`);
      }

      // Anomaly heuristics
      if (!cameraMake && !cameraModel && !hasGps) {
        anomalies.push('Missing camera make/model metadata (potential digital crop or screenshot)');
      }

      if (software && /photoshop|gimp|lightroom|paint|editor|canva/i.test(software)) {
        anomalies.push(`Image processed by editing software: ${software}`);
      }

      if (dateTime) {
        const parsedDate = new Date(dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
        if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now() + 86400000) {
          anomalies.push(`Future EXIF timestamp detected: ${dateTime}`);
        }
      }

      const passed = anomalies.length === 0;

      return {
        checkName: this.name,
        passed,
        score: Math.max(0, 1 - anomalies.length * 0.33),
        details: {
          cameraMake,
          cameraModel,
          hasGps,
          gpsSource,
          latitude,
          longitude,
          dateTime,
          software,
          screenshotDetection: {
            isScreenshot: screenshotAnalysis.isScreenshot,
            confidenceScore: screenshotAnalysis.confidenceScore,
            indicators: screenshotAnalysis.indicators,
          },
          anomaliesCount: anomalies.length,
          anomalies,
          hasExifData: Object.keys(tags).length > 0,
        },
      };
    } catch {
      // Perform Visual GPS Watermark Scan even if EXIF loading fails completely
      const visualGps = await this.scanVisualGpsWatermark(imageBuffer);

      const screenshotAnalysis = this.detectScreenshotHeuristics(
        {},
        inputMeta.width,
        inputMeta.height,
        inputMeta.format
      );

      return {
        checkName: this.name,
        passed: !screenshotAnalysis.isScreenshot,
        score: visualGps.hasGps ? 0.9 : 0.5,
        details: {
          cameraMake: null,
          cameraModel: null,
          hasGps: visualGps.hasGps,
          gpsSource: visualGps.hasGps ? 'Visual Watermark Overlay (GPS Map Camera)' : 'None',
          latitude: visualGps.latitude || null,
          longitude: visualGps.longitude || null,
          dateTime: null,
          software: null,
          screenshotDetection: {
            isScreenshot: screenshotAnalysis.isScreenshot,
            confidenceScore: screenshotAnalysis.confidenceScore,
            indicators: screenshotAnalysis.indicators,
          },
          anomaliesCount: visualGps.hasGps ? 0 : 1,
          anomalies: visualGps.hasGps ? [] : ['No EXIF metadata header present in image file'],
          hasExifData: false,
        },
      };
    }
  }
}

