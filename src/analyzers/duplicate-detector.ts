import sharp from 'sharp';
import { prisma } from '../lib/db';
import type { Analyzer, AnalyzerResult, ImageMetadataInput } from './types';

export class DuplicateDetector implements Analyzer {
  name = 'duplicate_detection';
  private maxHammingDistance = 10;

  // Compute 64-bit Difference Hash (dHash) using Sharp
  private async computeDHash(buffer: Buffer): Promise<string> {
    const resized = await sharp(buffer)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    let hashBits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const leftPixel = resized[row * 9 + col];
        const rightPixel = resized[row * 9 + col + 1];
        hashBits += leftPixel > rightPixel ? '1' : '0';
      }
    }

    // Convert 64-bit binary string to 16-character hex
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashBits.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }
    return hex;
  }

  // Calculate Hamming Distance between two hex strings
  private calculateHammingDistance(hex1: string, hex2: string): number {
    if (hex1.length !== hex2.length) return 64;

    let distance = 0;
    for (let i = 0; i < hex1.length; i++) {
      const val1 = parseInt(hex1[i], 16);
      const val2 = parseInt(hex2[i], 16);
      let xor = val1 ^ val2;
      while (xor > 0) {
        distance += xor & 1;
        xor >>= 1;
      }
    }
    return distance;
  }

  async analyze(
    imagePath: string,
    imageBuffer: Buffer,
    _metadata: ImageMetadataInput
  ): Promise<AnalyzerResult> {
    const currentHash = await this.computeDHash(imageBuffer);

    // Query existing images with non-null phash
    const existingImages = await prisma.image.findMany({
      where: {
        phash: { not: null },
        storedPath: { not: imagePath },
      },
      select: {
        id: true,
        originalName: true,
        phash: true,
      },
    });

    let closestMatchId: string | null = null;
    let closestMatchName: string | null = null;
    let minDistance = Infinity;

    for (const img of existingImages) {
      if (!img.phash) continue;
      const dist = this.calculateHammingDistance(currentHash, img.phash);
      if (dist < minDistance) {
        minDistance = dist;
        closestMatchId = img.id;
        closestMatchName = img.originalName;
      }
    }

    const isDuplicate = minDistance <= this.maxHammingDistance;

    return {
      checkName: this.name,
      passed: !isDuplicate, // Passed = true if NO duplicate detected
      score: minDistance === Infinity ? 64 : minDistance,
      details: {
        phash: currentHash,
        isDuplicate,
        closestMatchId,
        closestMatchName,
        hammingDistance: minDistance === Infinity ? null : minDistance,
        threshold: this.maxHammingDistance,
      },
    };
  }
}
