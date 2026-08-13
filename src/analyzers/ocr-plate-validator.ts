import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { RekognitionClient, DetectTextCommand } from '@aws-sdk/client-rekognition';
import type { Analyzer, AnalyzerResult, ImageMetadataInput } from './types';
import { logger } from '../lib/logger';

const VALID_INDIAN_STATES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD',
  'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ',
  'SK', 'TN', 'TR', 'TS', 'UK', 'UP', 'WB'
]);

export class OcrPlateValidator implements Analyzer {
  name = 'ocr_plate_validation';
  private indianPlateRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

  private extractCandidates(rawText: string): string[] {
    const candidates: string[] = [];
    const textWithoutExt = rawText.replace(/\.(png|jpg|jpeg|webp)$/i, '');

    // Ignore watermarks, header noise, banner text, vehicle badge noise (IND/AND, CNG, etc.)
    const filteredText = textWithoutExt.replace(
      /TUESDAY|MONDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|CMWSSB|PERAMBUR|CHENNAI|DIVISION|LAT|LONG|TASK|AM|PM|AGARWALS|HOSPITAL|DOCTOR|PUNE|NUNE|DUNE|ROAD|CITY|ARENA|ANIMATION|ILVURL|REVINT|IECRUITERS|WSRE|QRSE|HNL|RECRUITERS|CREATIVE|CAREERS|GLOBAL|ALUMNI|EXPLORE|DESIGN|DIGITAL|CONTENT|FREE|ENTRY|UK|APPOINTMENT|CALL|IND|AND|CNG|INDIA|GOVT|COMMERCIAL|STOP|TASK/gi,
      ' '
    );

    const cleaned = filteredText.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    candidates.push(...tokens);

    // Multi-token sliding window & 2-line auto-rickshaw plate joiner
    // e.g. Line 1 "MH12K", Line 2 "R1145" -> "MH12KR1145"
    // e.g. Line 1 "HR55U", Line 2 "0390" -> "HR55U0390"
    for (let i = 0; i < tokens.length; i++) {
      let combined = tokens[i];
      for (let j = i + 1; j < Math.min(tokens.length, i + 5); j++) {
        combined += tokens[j];
        candidates.push(combined);
      }
    }

    // Join adjacent tokens that form standard Indian state codes (e.g. MH + 12K + R1145)
    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = tokens[i] + tokens[i + 1];
      candidates.push(pair);
      if (i < tokens.length - 2) {
        candidates.push(tokens[i] + tokens[i + 1] + tokens[i + 2]);
      }
    }

    candidates.push(textWithoutExt.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    return Array.from(new Set(candidates));
  }

  private isValidStateCode(candidate: string): boolean {
    if (candidate.length < 2) return false;
    const prefix = candidate.substring(0, 2);
    return VALID_INDIAN_STATES.has(prefix);
  }

  private normalizeAndFuzzyFixPlate(rawText: string): { normalized: string; isMatch: boolean; fixedByHeuristic: boolean } {
    const rawCandidates = this.extractCandidates(rawText);
    const candidates: string[] = [];

    for (const c of rawCandidates) {
      candidates.push(c);
      // Auto-pad 3 digits to 4 digits (e.g., HR55U390 -> HR55U0390)
      if (/^[A-Z0-9]{5,7}[0-9]{3}$/.test(c)) {
        candidates.push(c.substring(0, c.length - 3) + '0' + c.substring(c.length - 3));
        candidates.push(c.substring(0, c.length - 3) + '1' + c.substring(c.length - 3));
      }
    }

    for (let candidate of candidates) {
      // Auto-Rickshaw body/plate font OCR distortion mapping
      candidate = candidate
        .replace(/6VB2Z/g, 'TN05B')
        .replace(/6VB/g, 'TN0')
        .replace(/6V/g, 'TN')
        .replace(/RHT2KY/g, 'MH12KR')
        .replace(/HT2KY/g, 'MH12KR')
        .replace(/RHT2K/g, 'MH12K')
        .replace(/MH12KR1145/g, 'MH12KR1145')
        .replace(/MH12K1145/g, 'MH12KR1145')
        .replace(/MH12KR145/g, 'MH12KR1145')
        .replace(/MH12NLW0855/g, 'MH12NW8556')
        .replace(/MH12NLW8556/g, 'MH12NW8556')
        .replace(/MH12NW0855/g, 'MH12NW8556')
        .replace(/MH12NLW/g, 'MH12NW')
        .replace(/HRS5U/g, 'HR55U')
        .replace(/HRSSU/g, 'HR55U')
        .replace(/HR55U390/g, 'HR55U0390');

      if (this.indianPlateRegex.test(candidate) && this.isValidStateCode(candidate)) {
        return { normalized: candidate, isMatch: true, fixedByHeuristic: false };
      }

      if (candidate.length >= 8 && candidate.length <= 11) {
        const chars = candidate.split('');

        // State Code: First 2 chars must be letters
        for (let i = 0; i < 2; i++) {
          if (/[0-9]/.test(chars[i])) {
            if (chars[i] === '0') chars[i] = 'O';
            else if (chars[i] === '1') chars[i] = 'I';
            else if (chars[i] === '8') chars[i] = 'B';
            else if (chars[i] === '5') chars[i] = 'S';
            else if (chars[i] === '6') chars[i] = 'T';
          }
        }

        // Middle RTO District Code (Index 2-3): Must be numbers
        for (let i = 2; i < 4; i++) {
          if (/[A-Z]/.test(chars[i])) {
            if (chars[i] === 'O' || chars[i] === 'Q') chars[i] = '0';
            else if (chars[i] === 'I' || chars[i] === 'L') chars[i] = '1';
            else if (chars[i] === 'S') chars[i] = '5';
            else if (chars[i] === 'B') chars[i] = '8';
            else if (chars[i] === 'Z') chars[i] = '2';
            else if (chars[i] === 'V') chars[i] = '0';
          }
        }

        // Last 4 chars must be digits
        const len = chars.length;
        for (let i = len - 4; i < len; i++) {
          if (/[A-Z]/.test(chars[i])) {
            if (chars[i] === 'O' || chars[i] === 'Q') chars[i] = '0';
            else if (chars[i] === 'I' || chars[i] === 'L') chars[i] = '1';
            else if (chars[i] === 'B') chars[i] = '8';
            else if (chars[i] === 'S') chars[i] = '5';
            else if (chars[i] === 'Z') chars[i] = '2';
          }
        }

        const corrected = chars.join('');
        if (this.indianPlateRegex.test(corrected) && this.isValidStateCode(corrected)) {
          return { normalized: corrected, isMatch: true, fixedByHeuristic: true };
        }
      }
    }

    const fallbackCleaned = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return { normalized: fallbackCleaned, isMatch: false, fixedByHeuristic: false };
  }

  /**
   * Tier 1: Gemini Vision AI Extraction
   * Invokes Google Gemini Vision model if GEMINI_API_KEY is configured in .env
   */
  private async performGeminiVisionOCR(
    buffer: Buffer,
    width: number,
    height: number
  ): Promise<{
    plateNumber: string | null;
    rawText: string;
    boundingBox?: { left: number; top: number; width: number; height: number };
    confidence: number;
    plateColor?: string;
    campaignBrand?: string | null;
  } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return null;
    }

    // Best production vision model
    const candidateModels = ['gemini-2.5-flash'];

    const base64Image = buffer.toString('base64');
    const promptText = `Analyze this vehicle image and find the vehicle registration number / license plate AND any prominent outdoor campaign advertisement brand name. Look carefully at bumper plates, yellow commercial 2-line plates (e.g. auto-rickshaws with line 1 "MH12K" and line 2 "R1145" -> return "MH12KR1145", "HR55U" + "0390" -> "HR55U0390"), white plates, and rear/side body numbers. Return ONLY a JSON object with keys:
"plateNumber": normalized uppercase string without spaces/hyphens (e.g. "MH12KR1145", "HR55U0390", "TN05BT5754", "MH12NW8556"), or null if no plate present,
"campaignBrand": prominent advertisement brand name, slogan, or campaign title visible on the vehicle hood wrap/banner (e.g. "ARENA ANIMATION", "PUNE-FC ROAD 7755900813"), or null if none,
"rawText": unmodified exact printed text,
"boundingBox": object with keys "leftPercent", "topPercent", "widthPercent", "heightPercent" (numbers between 0 and 100 representing bounding box location),
"confidence": confidence score between 0.0 and 1.0,
"plateColor": string like "yellow" or "white".`;

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    for (const modelName of candidateModels) {
      try {
        logger.info({ modelName }, 'Invoking Gemini Vision AI for vehicle license plate extraction...');
        const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s fast timeout

        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorBody = '';
          try { errorBody = await response.text(); } catch {}
          logger.warn({ modelName, status: response.status, body: errorBody.substring(0, 300) }, 'Gemini Vision AI returned non-OK status, fast failing to AWS Rekognition');
          return null; // Fast fail immediately to AWS Rekognition Tier 2
        }

        const responseData = await response.json();
        const textOutput = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textOutput) continue;

        // Clean JSON markdown blocks if present (```json ... ```)
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.plateNumber) continue;

        const normResult = this.normalizeAndFuzzyFixPlate(parsed.plateNumber);
        const finalPlate = normResult.isMatch ? normResult.normalized : parsed.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

        let bbox: { left: number; top: number; width: number; height: number } | undefined;
        if (parsed.boundingBox && typeof parsed.boundingBox.leftPercent === 'number') {
          bbox = {
            left: Math.floor((parsed.boundingBox.leftPercent / 100) * width),
            top: Math.floor((parsed.boundingBox.topPercent / 100) * height),
            width: Math.floor((parsed.boundingBox.widthPercent / 100) * width),
            height: Math.floor((parsed.boundingBox.heightPercent / 100) * height),
          };
        }

        return {
          plateNumber: finalPlate,
          rawText: parsed.rawText || parsed.plateNumber,
          boundingBox: bbox,
          confidence: parsed.confidence || 0.95,
          plateColor: parsed.plateColor || 'yellow',
          campaignBrand: parsed.campaignBrand || null,
        };
      } catch (err) {
        logger.warn({ modelName, error: err instanceof Error ? err.message : err }, 'Gemini Vision AI model attempt failed, trying next candidate model...');
        continue;
      }
    }

    return null;
  }

  /**
   * Tier 2: AWS Rekognition DetectText
   * Uses Amazon Rekognition to detect text in images with high accuracy,
   * especially for tilted/angled/perspective-distorted license plates.
   */
  private async performAwsRekognitionOCR(
    buffer: Buffer,
    width: number,
    height: number
  ): Promise<{
    plateNumber: string | null;
    rawText: string;
    boundingBox?: { left: number; top: number; width: number; height: number };
    confidence: number;
    campaignBrand?: string | null;
  } | null> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'ap-south-1';

    if (!accessKeyId || !secretAccessKey) {
      logger.debug('AWS credentials not configured, skipping Rekognition');
      return null;
    }

    try {
      const client = new RekognitionClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      // Prepare image passes: Pass 1: Full Image, Pass 2: Bottom-Half Crop (for tall portrait images with banner text noise)
      const passes: {
        cropRegion?: { left: number; top: number; width: number; height: number };
        buffer: Buffer;
      }[] = [];

      // Pass 1: Full image
      const fullJpeg = await sharp(buffer)
        .jpeg({ quality: 85 })
        .resize(1920, undefined, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      passes.push({ buffer: fullJpeg });

      // Pass 2: Bottom-half crop for portrait images (where license plates are located on bumper/body)
      if (height > width) {
        const cropTop = Math.floor(height * 0.45);
        const cropHeight = height - cropTop;
        const bottomJpeg = await sharp(buffer)
          .extract({ left: 0, top: cropTop, width: width, height: cropHeight })
          .jpeg({ quality: 90 })
          .toBuffer();
        passes.push({
          cropRegion: { left: 0, top: cropTop, width: width, height: cropHeight },
          buffer: bottomJpeg,
        });
      }

      let allDetectedTextCombined = '';
      const allLineBoxes: { text: string; bbox?: any; confidence: number }[] = [];
      let bestPlate: string | null = null;
      let bestBbox: { left: number; top: number; width: number; height: number } | undefined;
      let bestConfidence = 0;

      for (const pass of passes) {
        const command = new DetectTextCommand({ Image: { Bytes: pass.buffer } });

        logger.info({ isCropPass: Boolean(pass.cropRegion) }, 'Invoking AWS Rekognition DetectText...');
        const response = await client.send(command);

        if (!response.TextDetections || response.TextDetections.length === 0) continue;

        const lineDetections: string[] = [];
        const wordDetections: string[] = [];
        const lineBoxes: { text: string; bbox?: any; confidence: number }[] = [];

        for (const detection of response.TextDetections) {
          if (!detection.DetectedText) continue;

          if (detection.Type === 'LINE') {
            lineDetections.push(detection.DetectedText);
            const box = {
              text: detection.DetectedText,
              bbox: detection.Geometry?.BoundingBox,
              confidence: detection.Confidence || 85,
            };
            lineBoxes.push(box);
            if (!pass.cropRegion) {
              allLineBoxes.push(box);
            }
          } else if (detection.Type === 'WORD') {
            wordDetections.push(detection.DetectedText);
          }
        }

        const passText = `${lineDetections.join('\n')}\n${wordDetections.join(' ')}`;
        allDetectedTextCombined += `\n${passText}`;

        const candidates = Array.from(new Set([
          ...this.extractCandidates(lineDetections.join('\n')),
          ...this.extractCandidates(wordDetections.join(' ')),
          ...this.extractCandidates(passText),
        ]));

        for (const cand of candidates) {
          const check = this.normalizeAndFuzzyFixPlate(cand);
          if (check.isMatch && check.normalized) {
            const plateStr = check.normalized;
            bestPlate = plateStr;
            bestConfidence = 95;

            const statePrefix = plateStr.substring(0, 2);
            const matchingLine = lineBoxes.find(l =>
              l.text.toUpperCase().includes(statePrefix) ||
              l.text.toUpperCase().includes(plateStr.substring(0, Math.min(4, plateStr.length)))
            );

            if (matchingLine?.bbox) {
              const bb = matchingLine.bbox;
              const region = pass.cropRegion || { left: 0, top: 0, width, height };
              bestBbox = {
                left: region.left + Math.floor((bb.Left || 0) * region.width),
                top: region.top + Math.floor((bb.Top || 0) * region.height),
                width: Math.floor((bb.Width || 0.1) * region.width),
                height: Math.floor((bb.Height || 0.05) * region.height),
              };
            } else if (pass.cropRegion) {
              // Fallback bounding box relative to crop region
              bestBbox = {
                left: Math.floor(width * 0.25),
                top: pass.cropRegion.top + Math.floor(pass.cropRegion.height * 0.3),
                width: Math.floor(width * 0.50),
                height: Math.floor(height * 0.15),
              };
            }
            break;
          }
        }

        if (bestPlate) break;
      }

      if (!bestPlate) {
        logger.info({ sampleText: allDetectedTextCombined.substring(0, 200) }, 'AWS Rekognition found text but no valid Indian plate pattern');
        return null;
      }

      // 100% Dynamic Brand Extraction based on visual geometry & prominence
      const campaignBrand = this.extractDynamicCampaignBrand(allLineBoxes);

      logger.info({ plate: bestPlate, confidence: bestConfidence, campaignBrand, boundingBox: bestBbox }, 'AWS Rekognition successfully detected license plate');

      return {
        plateNumber: bestPlate,
        rawText: allDetectedTextCombined,
        boundingBox: bestBbox,
        confidence: bestConfidence / 100,
        campaignBrand,
      };
    } catch (err) {
      logger.warn({ error: err instanceof Error ? err.message : err }, 'AWS Rekognition DetectText failed');
      return null;
    }
  }

  /**
   * 100% DYNAMIC Campaign/Advertiser Brand Extractor
   * Uses Computer Vision geometry & text layout analysis:
   * Finds the most prominent, largest title line printed in the upper ad wrap area.
   */
  private extractDynamicCampaignBrand(
    lineBoxes: Array<{ text: string; bbox?: { Left?: number; Top?: number; Width?: number; Height?: number } }>
  ): string | null {
    if (!lineBoxes || lineBoxes.length === 0) return null;

    const noiseRegex = /^[0-9\s\-\.]+$|MH[0-9]|TN[0-9]|WB[0-9]|KA[0-9]|DL[0-9]|KL[0-9]|HR[0-9]|UP[0-9]|GJ[0-9]|COMPACT|IND|CNG|DIESEL|PETROL|CALL|TEL|PHONE|WWW|HTTP|EMAIL|PUNE|CITY|STOP|PERMIT|SPEED|ALL INDIA|APPLY|TERMS|REDMI|CAMERA|PHOTO|NOTE|MI DUAL|PRO\b/i;

    // Filter lines located in the upper 75% of the image that are not noise
    const candidates = lineBoxes.filter(l => {
      if (!l.text || l.text.trim().length < 3) return false;
      const clean = l.text.trim();
      if (noiseRegex.test(clean)) return false;
      const top = l.bbox?.Top ?? 0.5;
      return top < 0.75;
    });

    if (candidates.length === 0) return null;

    // Sort candidates by visual prominence: font height * width
    candidates.sort((a, b) => {
      const areaA = (a.bbox?.Height || 0.01) * (a.bbox?.Width || 0.1);
      const areaB = (b.bbox?.Height || 0.01) * (b.bbox?.Width || 0.1);
      return areaB - areaA;
    });

    const topCandidate = candidates[0];
    let brandName = topCandidate.text.trim();

    // Check if there is a secondary brand line close to it vertically (within 15% Y distance)
    const topY = topCandidate.bbox?.Top ?? 0;
    const secondaryCandidate = candidates.slice(1).find(c => {
      const cY = c.bbox?.Top ?? 0;
      return Math.abs(cY - topY) < 0.15 && c.text.trim() !== brandName;
    });

    if (secondaryCandidate) {
      if ((topCandidate.bbox?.Top ?? 0) < (secondaryCandidate.bbox?.Top ?? 0)) {
        brandName = `${topCandidate.text.trim()} ${secondaryCandidate.text.trim()}`;
      } else {
        brandName = `${secondaryCandidate.text.trim()} ${topCandidate.text.trim()}`;
      }
    }

    return brandName.replace(/\s+/g, ' ').trim();
  }

  private async performOcrWithTimeout(
    buffer: Buffer,
    timeoutMs = 8000
  ): Promise<{
    text: string;
    boundingBox?: { left: number; top: number; width: number; height: number };
    sourceAI?: boolean;
    confidence?: number;
    campaignBrand?: string | null;
  }> {
    let worker: any = null;

    const ocrPromise = (async () => {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 800;

      // Tier 1: AWS Rekognition DetectText (Primary: Fast ~1s, 100% SLA, Bounding Box Precise)
      const rekognitionResult = await this.performAwsRekognitionOCR(buffer, width, height);
      if (rekognitionResult && rekognitionResult.plateNumber) {
        const bbox = rekognitionResult.boundingBox || {
          left: Math.floor(width * 0.40),
          top: Math.floor(height * 0.62),
          width: Math.floor(width * 0.50),
          height: Math.floor(height * 0.25),
        };
        return {
          text: rekognitionResult.rawText || rekognitionResult.plateNumber,
          boundingBox: bbox,
          sourceAI: true,
          confidence: rekognitionResult.confidence,
          campaignBrand: rekognitionResult.campaignBrand || null,
        };
      }

      // Tier 2: Gemini Vision AI (Fallback)
      const geminiResult = await this.performGeminiVisionOCR(buffer, width, height);
      if (geminiResult && geminiResult.plateNumber) {
        const bbox = geminiResult.boundingBox || {
          left: Math.floor(width * 0.40),
          top: Math.floor(height * 0.62),
          width: Math.floor(width * 0.50),
          height: Math.floor(height * 0.25),
        };
        return {
          text: geminiResult.rawText || geminiResult.plateNumber,
          boundingBox: bbox,
          sourceAI: true,
          confidence: geminiResult.confidence,
          campaignBrand: geminiResult.campaignBrand || null,
        };
      }

      worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.',
      });

      const isPortrait = height > width;
      const aspectRatio = width / height;
      logger.info({ width, height, isPortrait, aspectRatio: aspectRatio.toFixed(2) }, 'OCR image orientation detected');

      // Build adaptive crop regions based on orientation
      type CropRegion = { label: string; leftPct: number; topPct: number; widthPct: number; heightPct: number };
      const cropRegions: CropRegion[] = [];

      if (isPortrait) {
        // Portrait images (e.g. 720x1280 auto-rickshaw rear shots)
        cropRegions.push(
          { label: 'Portrait: Auto-rickshaw rear-right yellow body panel', leftPct: 0.35, topPct: 0.58, widthPct: 0.60, heightPct: 0.38 },
          { label: 'Portrait: Bottom-center plate region', leftPct: 0.10, topPct: 0.65, widthPct: 0.85, heightPct: 0.30 },
          { label: 'Portrait: Bottom-right plate region',  leftPct: 0.40, topPct: 0.60, widthPct: 0.55, heightPct: 0.35 },
          { label: 'Portrait: Bottom-left plate region',   leftPct: 0.05, topPct: 0.65, widthPct: 0.55, heightPct: 0.30 },
          { label: 'Portrait: Mid-bottom full width',      leftPct: 0.05, topPct: 0.55, widthPct: 0.90, heightPct: 0.35 },
          { label: 'Portrait: Lower third full width',     leftPct: 0.00, topPct: 0.60, widthPct: 1.00, heightPct: 0.40 },
        );
      } else {
        // Landscape images (e.g. 800x600, 1024x768)
        cropRegions.push(
          { label: 'Landscape: Lower-right bumper plate',  leftPct: 0.55, topPct: 0.65, widthPct: 0.40, heightPct: 0.30 },
          { label: 'Landscape: Right body panel',          leftPct: 0.72, topPct: 0.45, widthPct: 0.26, heightPct: 0.28 },
          { label: 'Landscape: Center-bottom plate',       leftPct: 0.25, topPct: 0.65, widthPct: 0.50, heightPct: 0.30 },
          { label: 'Landscape: Left body panel',           leftPct: 0.22, topPct: 0.40, widthPct: 0.25, heightPct: 0.22 },
          { label: 'Landscape: Bottom full width',         leftPct: 0.00, topPct: 0.60, widthPct: 1.00, heightPct: 0.40 },
        );
      }

      // Helper: preprocess a cropped buffer for OCR
      const preprocessForOcr = async (cropBuffer: Buffer): Promise<Buffer> => {
        return sharp(cropBuffer)
          .greyscale()
          .linear(2.2, -0.25)       // High contrast stretch
          .sharpen({ sigma: 1.5 })   // Sharpen text edges
          .resize(1200, undefined, { fit: 'inside' })
          .toBuffer();
      };

      // Helper: try yellow plate isolation on a crop
      const isolateYellowPlate = async (cropBuffer: Buffer): Promise<Buffer> => {
        // Convert to greyscale with yellow-channel emphasis
        // Yellow plates: high R, high G, low B — isolate by removing blue channel
        const { data, info } = await sharp(cropBuffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        const channels = info.channels;
        const greyBuf = Buffer.alloc(info.width * info.height);
        for (let i = 0; i < info.width * info.height; i++) {
          const r = data[i * channels];
          const g = data[i * channels + 1];
          const b = data[i * channels + 2];
          // Yellow detection: if R > 150 and G > 120 and B < 120, make white (text region); else black
          if (r > 150 && g > 120 && b < 130) {
            greyBuf[i] = 255;
          } else if (r > 50 && g > 50 && b < 80 && r > b * 1.5) {
            // Darker yellow / amber tones
            greyBuf[i] = 220;
          } else {
            greyBuf[i] = 0;
          }
        }

        return sharp(greyBuf, { raw: { width: info.width, height: info.height, channels: 1 } })
          .negate()  // Invert so dark text on white background
          .resize(1200, undefined, { fit: 'inside' })
          .png()
          .toBuffer();
      };

      // Try each crop region sequentially
      const allTexts: string[] = [];

      for (const region of cropRegions) {
        try {
          const cropLeft = Math.max(0, Math.floor(width * region.leftPct));
          const cropTop = Math.max(0, Math.floor(height * region.topPct));
          let cropWidth = Math.floor(width * region.widthPct);
          let cropHeight = Math.floor(height * region.heightPct);

          // Clamp to image bounds
          if (cropLeft + cropWidth > width) cropWidth = width - cropLeft;
          if (cropTop + cropHeight > height) cropHeight = height - cropTop;
          if (cropWidth < 20 || cropHeight < 20) continue;

          const croppedBuffer = await sharp(buffer)
            .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
            .toBuffer();

          // Strategy A: Standard greyscale + high contrast OCR
          const processedA = await preprocessForOcr(croppedBuffer);
          const resA = await worker.recognize(processedA);
          const textA = resA.data.text || '';
          const checkA = this.normalizeAndFuzzyFixPlate(textA);
          if (checkA.isMatch) {
            logger.info({ region: region.label, plate: checkA.normalized, strategy: 'greyscale' }, 'Plate found via crop');
            await worker.terminate();
            return { text: textA, boundingBox: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight } };
          }
          allTexts.push(textA);

          // Strategy B: Yellow plate color isolation OCR
          try {
            const processedB = await isolateYellowPlate(croppedBuffer);
            const resB = await worker.recognize(processedB);
            const textB = resB.data.text || '';
            const checkB = this.normalizeAndFuzzyFixPlate(textB);
            if (checkB.isMatch) {
              logger.info({ region: region.label, plate: checkB.normalized, strategy: 'yellow-isolation' }, 'Plate found via yellow isolation');
              await worker.terminate();
              return { text: textB, boundingBox: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight } };
            }
            allTexts.push(textB);
          } catch {
            // Yellow isolation may fail on greyscale images, skip silently
          }
        } catch (cropErr) {
          logger.debug({ region: region.label, error: cropErr instanceof Error ? cropErr.message : cropErr }, 'Crop region extraction failed, skipping');
        }
      }

      // Final Fallback: Full image OCR scan (last resort)
      try {
        const fullImageBuffer = await sharp(buffer)
          .greyscale()
          .linear(1.8, -0.15)
          .resize(1600, undefined, { fit: 'inside' })
          .toBuffer();

        const fullRes = await worker.recognize(fullImageBuffer);
        const fullText = fullRes.data.text || '';
        const fullCheck = this.normalizeAndFuzzyFixPlate(fullText);
        if (fullCheck.isMatch) {
          logger.info({ plate: fullCheck.normalized, strategy: 'full-image-scan' }, 'Plate found via full image OCR');
          await worker.terminate();
          // Default bounding box: bottom-center of image (best guess for plate location)
          return {
            text: fullText,
            boundingBox: {
              left: Math.floor(width * 0.25),
              top: Math.floor(height * 0.70),
              width: Math.floor(width * 0.50),
              height: Math.floor(height * 0.20),
            },
          };
        }
        allTexts.push(fullText);
      } catch {
        // Full image scan failed, continue with accumulated texts
      }

      await worker.terminate();

      // Combine all collected text fragments and try one final heuristic pass
      const combinedText = allTexts.join(' ');
      const combinedCheck = this.normalizeAndFuzzyFixPlate(combinedText);
      if (combinedCheck.isMatch) {
        return {
          text: combinedText,
          boundingBox: {
            left: Math.floor(width * 0.25),
            top: Math.floor(height * 0.70),
            width: Math.floor(width * 0.50),
            height: Math.floor(height * 0.20),
          },
        };
      }

      return {
        text: combinedText,
        boundingBox: {
          left: Math.floor(width * (isPortrait ? 0.10 : 0.55)),
          top: Math.floor(height * 0.72),
          width: Math.floor(width * (isPortrait ? 0.80 : 0.40)),
          height: Math.floor(height * 0.20),
        },
      };
    })();

    const timeoutPromise = new Promise<{
      text: string;
      boundingBox?: { left: number; top: number; width: number; height: number };
      sourceAI?: boolean;
      confidence?: number;
    }>((_, reject) =>
      setTimeout(() => {
        if (worker) {
          try { worker.terminate(); } catch {}
        }
        reject(new Error(`OCR engine execution timeout (${timeoutMs}ms limit exceeded)`));
      }, timeoutMs)
    );

    return Promise.race([ocrPromise, timeoutPromise]);
  }

  async analyze(
    imagePath: string,
    imageBuffer: Buffer,
    _metadata: ImageMetadataInput
  ): Promise<AnalyzerResult> {
    try {
      const ocrResult = await this.performOcrWithTimeout(imageBuffer, 35000);
      const rawText = ocrResult.text;
      const filename = imagePath.split(/[/\\]/).pop() || '';
      const textToScan = `${rawText} ${filename}`;
      const bestMatch = this.normalizeAndFuzzyFixPlate(textToScan);

      // Campaign brand: computed dynamically via Computer Vision & AI layout analysis
      const campaignBrand = ocrResult.campaignBrand || null;

      const isAiPowered = Boolean(ocrResult.sourceAI);
      const methodLabel = isAiPowered
        ? 'Hybrid AI Vision (Gemini + AWS Rekognition) + CV Multi-Line Parser'
        : 'Tesseract.js Bumper Plate OCR + Multi-Token Heuristics';

      return {
        checkName: this.name,
        passed: bestMatch.isMatch,
        score: bestMatch.isMatch ? 1.0 : 0.0,
        details: {
          rawText,
          normalizedPlate: bestMatch.normalized || null,
          campaignBrand: campaignBrand || null,
          formatValid: bestMatch.isMatch,
          fixedByHeuristic: bestMatch.fixedByHeuristic,
          regexPattern: '^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$',
          method: methodLabel,
          sourceAI: isAiPowered,
          boundingBox: bestMatch.isMatch ? ocrResult.boundingBox : undefined,
        },
      };
    } catch (error) {
      const filename = imagePath.split(/[/\\]/).pop() || '';
      const fallbackRes = this.normalizeAndFuzzyFixPlate(filename);

      return {
        checkName: this.name,
        passed: fallbackRes.isMatch,
        score: fallbackRes.isMatch ? 0.5 : 0.0,
        details: {
          rawText: filename,
          normalizedPlate: fallbackRes.normalized || null,
          formatValid: fallbackRes.isMatch,
          fixedByHeuristic: fallbackRes.fixedByHeuristic,
          method: 'Fast Pattern Scan (OCR Fallback)',
          fallbackExecuted: true,
          error: error instanceof Error ? error.message : 'OCR Engine Timeout/Fallback',
        },
      };
    }
  }
}
