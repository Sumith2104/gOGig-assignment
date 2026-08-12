import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface CvAnnotationData {
  imageWidth: number;
  imageHeight: number;
  laplacianStdev?: number;
  meanBrightness?: number;
  plateBoundingBox?: { left: number; top: number; width: number; height: number };
  plateText?: string;
  isPlateValid?: boolean;
  hasGps?: boolean;
  latitude?: number;
  longitude?: number;
}

export class CvAnnotationService {
  /**
   * Generates a Computer Vision composite overlay image with feature detection boxes,
   * edge corners, and metadata stamps directly drawn on the source image.
   */
  static async generateAnnotatedImage(
    sourcePath: string,
    data: CvAnnotationData
  ): Promise<Buffer> {
    const absolutePath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.join(process.cwd(), sourcePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Source image not found for annotation: ${absolutePath}`);
    }

    const imageBuffer = fs.readFileSync(absolutePath);
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 800;

    const overlays: string[] = [];

    // 1. Draw License Plate Bounding Box
    // Green = valid plate found, Amber = plate detected but invalid format, Red = search region (no plate detected)
    if (data.plateBoundingBox) {
      const { left, top, width: boxWidth, height: boxHeight } = data.plateBoundingBox;
      const hasPlateText = data.plateText && data.plateText.length > 2 && data.plateText !== 'undefined';
      
      let strokeColor: string;
      let labelBg: string;
      let labelText: string;
      let fillOpacity: string;

      if (data.isPlateValid) {
        strokeColor = '#10B981'; // Green
        labelBg = '#065F46';
        labelText = `[VALID] ${data.plateText || 'PLATE'}`;
        fillOpacity = '0.12';
      } else if (hasPlateText) {
        strokeColor = '#F59E0B'; // Amber
        labelBg = '#92400E';
        labelText = `[FLAGGED] ${data.plateText}`;
        fillOpacity = '0.10';
      } else {
        strokeColor = '#EF4444'; // Red
        labelBg = '#7F1D1D';
        labelText = '[SCAN REGION] Plate Not Detected';
        fillOpacity = '0.06';
      }

      // Corner Crosshairs & Bounding Box Rectangle
      overlays.push(`
        <g id="plate_bounding_box">
          <!-- Main Bounding Rectangle -->
          <rect x="${left}" y="${top}" width="${boxWidth}" height="${boxHeight}"
                fill="${strokeColor}" fill-opacity="${fillOpacity}"
                stroke="${strokeColor}" stroke-width="${data.isPlateValid ? 4 : 3}" stroke-dasharray="${data.isPlateValid ? '8,4' : '12,6'}" rx="4" />
          
          <!-- Corner Focus Markers -->
          <line x1="${left - 6}" y1="${top}" x2="${left + 16}" y2="${top}" stroke="${strokeColor}" stroke-width="5" />
          <line x1="${left}" y1="${top - 6}" x2="${left}" y2="${top + 16}" stroke="${strokeColor}" stroke-width="5" />
          
          <line x1="${left + boxWidth - 16}" y1="${top}" x2="${left + boxWidth + 6}" y2="${top}" stroke="${strokeColor}" stroke-width="5" />
          <line x1="${left + boxWidth}" y1="${top - 6}" x2="${left + boxWidth}" y2="${top + 16}" stroke="${strokeColor}" stroke-width="5" />

          <line x1="${left - 6}" y1="${top + boxHeight}" x2="${left + 16}" y2="${top + boxHeight}" stroke="${strokeColor}" stroke-width="5" />
          <line x1="${left}" y1="${top + boxHeight - 16}" x2="${left}" y2="${top + boxHeight + 6}" stroke="${strokeColor}" stroke-width="5" />
          
          <line x1="${left + boxWidth - 16}" y1="${top + boxHeight}" x2="${left + boxWidth + 6}" y2="${top + boxHeight}" stroke="${strokeColor}" stroke-width="5" />
          <line x1="${left + boxWidth}" y1="${top + boxHeight - 16}" x2="${left + boxWidth}" y2="${top + boxHeight + 6}" stroke="${strokeColor}" stroke-width="5" />

          <!-- Feature Corner Points -->
          <circle cx="${left}" cy="${top}" r="5" fill="${strokeColor}" />
          <circle cx="${left + boxWidth}" cy="${top}" r="5" fill="${strokeColor}" />
          <circle cx="${left}" cy="${top + boxHeight}" r="5" fill="${strokeColor}" />
          <circle cx="${left + boxWidth}" cy="${top + boxHeight}" r="5" fill="${strokeColor}" />

          <!-- Plate Label Tag -->
          <rect x="${left}" y="${Math.max(10, top - 32)}" width="${Math.max(280, labelText.length * 9 + 40)}" height="30"
                fill="${labelBg}" fill-opacity="0.92" rx="4" stroke="${strokeColor}" stroke-width="1.5" />
          <text x="${left + 10}" y="${Math.max(30, top - 12)}" fill="#FFFFFF" font-family="monospace, sans-serif"
                font-size="14" font-weight="bold">
            ${labelText}
          </text>
        </g>
      `);
    }

    // 2. Draw Visual GPS Location Watermark Badge
    if (data.hasGps && data.latitude && data.longitude) {
      const lat = data.latitude.toFixed(6);
      const long = data.longitude.toFixed(6);
      overlays.push(`
        <g id="gps_watermark_badge">
          <rect x="20" y="${height - 65}" width="380" height="45"
                fill="#0F172A" fill-opacity="0.90" rx="6" stroke="#3B82F6" stroke-width="2" />
          <text x="35" y="${height - 37}" fill="#60A5FA" font-family="monospace, sans-serif"
                font-size="13" font-weight="bold">
            GPS STAMP VERIFIED: ${lat}, ${long}
          </text>
        </g>
      `);
    }

    // 3. Draw CV Laplacian Sharpness HUD Badge
    if (data.laplacianStdev !== undefined) {
      const stdev = data.laplacianStdev.toFixed(1);
      overlays.push(`
        <g id="cv_metrics_hud">
          <rect x="${width - 240}" y="20" width="220" height="40"
                fill="#0F172A" fill-opacity="0.88" rx="6" stroke="#475569" stroke-width="1.5" />
          <text x="${width - 225}" y="45" fill="#E2E8F0" font-family="monospace, sans-serif"
                font-size="13" font-weight="bold">
            LAPLACIAN: ${stdev} VAR
          </text>
        </g>
      `);
    }

    // Combine all SVGs into single overlay canvas
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${overlays.join('\n')}
      </svg>
    `;

    return sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }
}
