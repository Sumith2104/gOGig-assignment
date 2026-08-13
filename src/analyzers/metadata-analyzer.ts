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

  async analyze(
    _imagePath: string,
    imageBuffer: Buffer,
    _metadata: ImageMetadataInput
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

      // Anomaly heuristics
      if (software && /photoshop|gimp|lightroom|paint|editor|canva/i.test(software)) {
        anomalies.push(`Image edited using graphics software: ${software}`);
      }

      if (dateTime) {
        const parsedDate = new Date(dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
        if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now() + 86400000) {
          anomalies.push(`Future EXIF timestamp detected: ${dateTime}`);
        }
      }

      const hasEditingAnomalies = anomalies.length > 0;
      const resultStatus = hasEditingAnomalies ? 'ISSUE_DETECTED' : 'NO_ISSUE_DETECTED';

      return {
        checkName: this.name,
        resultStatus,
        passed: !hasEditingAnomalies,
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
          anomaliesCount: anomalies.length,
          anomalies,
          hasExifData: Object.keys(tags).length > 0,
          evidence: Object.keys(tags).length > 0
            ? `EXIF headers extracted successfully. Camera Make: ${cameraMake || 'N/A'}, GPS Source: ${gpsSource}.`
            : `EXIF headers absent (common for compressed web uploads / messaging apps). GPS Source: ${gpsSource}.`,
        },
      };
    } catch {
      // Perform Visual GPS Watermark Scan even if EXIF loading fails completely
      const visualGps = await this.scanVisualGpsWatermark(imageBuffer);

      return {
        checkName: this.name,
        resultStatus: 'NO_ISSUE_DETECTED',
        passed: true,
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
          anomaliesCount: 0,
          anomalies: [],
          hasExifData: false,
          evidence: 'EXIF metadata header absent. Visual GPS watermark scanned.',
        },
      };
    }
  }
}
