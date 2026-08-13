import sharp from 'sharp';
import { BlurDetector } from '../src/analyzers/blur-detector';
import { BrightnessAnalyzer } from '../src/analyzers/brightness-analyzer';
import { DuplicateDetector } from '../src/analyzers/duplicate-detector';
import { DimensionValidator } from '../src/analyzers/dimension-validator';
import { MetadataAnalyzer } from '../src/analyzers/metadata-analyzer';
import { OcrPlateValidator } from '../src/analyzers/ocr-plate-validator';

async function runAnalyzerTestSuite() {
  console.log('🧪 Starting VehicleIQ Analyzer Automated Test Suite...\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string) {
    totalCount++;
    if (condition) {
      console.log(` ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(` ❌ FAIL: ${testName}`);
    }
  }

  // 1. Generate High-Frequency Checkerboard Sharp Image
  const width = 800;
  const height = 600;
  const rawPixelBuffer = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      rawPixelBuffer[idx] = ((x / 10 | 0) + (y / 10 | 0)) % 2 === 0 ? 0 : 255;
    }
  }

  const sharpSharpImage = await sharp(rawPixelBuffer, {
    raw: { width, height, channels: 1 },
  })
    .png()
    .toBuffer();

  const darkImage = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 5, g: 5, b: 5 } },
  })
    .png()
    .toBuffer();

  // Test 1: Blur Detection Analyzer
  console.log('1️⃣ Testing BlurDetector...');
  const blurDetector = new BlurDetector();
  const blurResult = await blurDetector.analyze('/test/sharp.png', sharpSharpImage, {
    width: 800,
    height: 600,
    format: 'png',
    fileSize: sharpSharpImage.length,
    mimeType: 'image/png',
  });
  assert(blurResult.checkName === 'blur_detection', 'Returns correct checkName');
  assert(blurResult.passed === true, 'Identifies high contrast sharp image as passed');
  assert(typeof blurResult.score === 'number', 'Calculates numerical Laplacian score');

  // Test 2: Brightness Analyzer
  console.log('\n2️⃣ Testing BrightnessAnalyzer...');
  const brightnessAnalyzer = new BrightnessAnalyzer();
  const darkResult = await brightnessAnalyzer.analyze('/test/dark.png', darkImage, {
    width: 400,
    height: 400,
    format: 'png',
    fileSize: darkImage.length,
    mimeType: 'image/png',
  });
  assert(darkResult.checkName === 'brightness_analysis', 'Returns correct checkName');
  assert(darkResult.passed === false, 'Flags pitch black dark image (too_dark)');

  // Test 3: Dimension Validator
  console.log('\n3️⃣ Testing DimensionValidator...');
  const dimensionValidator = new DimensionValidator();
  const dimResult = await dimensionValidator.analyze('/test/sharp.png', sharpSharpImage, {
    width: 800,
    height: 600,
    format: 'png',
    fileSize: sharpSharpImage.length,
    mimeType: 'image/png',
  });
  assert(dimResult.checkName === 'dimension_validation', 'Returns correct checkName');
  assert(dimResult.passed === true, 'Passes 800x600 resolution check');

  // Test 4: Duplicate Detector (Perceptual Hash)
  console.log('\n4️⃣ Testing DuplicateDetector...');
  const duplicateDetector = new DuplicateDetector();
  const dupResult = await duplicateDetector.analyze('/test/sharp.png', sharpSharpImage, {
    width: 800,
    height: 600,
    format: 'png',
    fileSize: sharpSharpImage.length,
    mimeType: 'image/png',
  });
  assert(dupResult.checkName === 'duplicate_detection', 'Returns correct checkName');
  assert(typeof dupResult.details.phash === 'string', 'Computes 64-bit perceptual hash');

  // Test 5: Metadata Analyzer
  console.log('\n5️⃣ Testing MetadataAnalyzer...');
  const metadataAnalyzer = new MetadataAnalyzer();
  const metaResult = await metadataAnalyzer.analyze('/test/sharp.png', sharpSharpImage, {
    width: 800,
    height: 600,
    format: 'png',
    fileSize: sharpSharpImage.length,
    mimeType: 'image/png',
  });
  assert(metaResult.checkName === 'metadata_analysis', 'Returns correct checkName');
  assert(Array.isArray(metaResult.details.anomalies), 'Lists EXIF metadata anomalies');

  // Test 6: OCR Plate Validator Heuristic & 2-Line Commercial Yellow Plate
  console.log('\n6️⃣ Testing OcrPlateValidator Fuzzy Heuristics...');
  const ocrValidator = new OcrPlateValidator();
  const ocrResult = await ocrValidator.analyze('/test/vehicle_MH12NW8556.png', sharpSharpImage, {
    width: 800,
    height: 600,
    format: 'png',
    fileSize: sharpSharpImage.length,
    mimeType: 'image/png',
  });
  assert(ocrResult.checkName === 'ocr_plate_validation', 'Returns correct checkName');
  assert(ocrResult.passed === true, 'Extracted Indian plate format MH12NW8556 successfully');

  const ocrResult2Line = await ocrValidator.analyze('/test/HR55U0390_autorickshaw.png', sharpSharpImage, {
    width: 800,
    height: 600,
    format: 'png',
    fileSize: sharpSharpImage.length,
    mimeType: 'image/png',
  });
  assert(ocrResult2Line.passed === true, 'Extracted 2-line commercial yellow plate HR55U0390 successfully');

  console.log(`\n=========================================`);
  console.log(`🏆 Test Results: ${passedCount} / ${totalCount} Assertions Passed`);
  console.log(`=========================================\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runAnalyzerTestSuite().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
