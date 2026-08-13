import { PrismaClient, ProcessingStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial demo records...');

  const sampleImage = await prisma.image.upsert({
    where: { storedPath: './uploads/demo_vehicle_1.jpg' },
    update: {},
    create: {
      originalName: 'vehicle_front_MH12AB1234.jpg',
      storedPath: './uploads/demo_vehicle_1.jpg',
      fileSize: 2457600,
      mimeType: 'image/jpeg',
      phash: 'a4e8f2c1b3d7e9f0',
      idempotencyKey: 'demo-seed-key-1',
      status: ProcessingStatus.COMPLETED,
      processedAt: new Date(),
      analysisResults: {
        create: [
          {
            checkName: 'blur_detection',
            passed: true,
            score: 245.7,
            details: { laplacianStdev: 245.7, threshold: 10, assessment: 'sharp', method: 'Laplacian Variance (3x3 Kernel)' },
            durationMs: 124,
          },
          {
            checkName: 'brightness_analysis',
            passed: true,
            score: 142.3,
            details: { meanBrightness: 142.3, assessment: 'normal', range: { min: 40, max: 220 } },
            durationMs: 89,
          },
          {
            checkName: 'duplicate_detection',
            passed: true,
            score: 64,
            details: { phash: 'a4e8f2c1b3d7e9f0', isDuplicate: false, closestMatchId: null },
            durationMs: 156,
          },
          {
            checkName: 'ocr_plate_validation',
            passed: true,
            score: 1.0,
            details: { rawText: 'MH 12 AB 1234', normalizedPlate: 'MH12AB1234', formatValid: true },
            durationMs: 2340,
          },
          {
            checkName: 'dimension_validation',
            passed: true,
            score: 2.1,
            details: { width: 1920, height: 1080, megaPixels: 2.1, aspectRatio: 1.78 },
            durationMs: 12,
          },
          {
            checkName: 'metadata_analysis',
            passed: true,
            score: 1.0,
            details: { cameraMake: 'Samsung', cameraModel: 'Galaxy S21', hasGps: true, anomaliesCount: 0 },
            durationMs: 45,
          },
        ],
      },
    },
  });

  console.log(`Seeded demo image record with ID: ${sampleImage.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
