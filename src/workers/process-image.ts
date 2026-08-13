import { Job } from 'bullmq';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../lib/db';
import { storageService } from '../services/storage-service';
import { analyzers, type AnalyzerResult } from '../analyzers';
import { CvAnnotationService } from '../services/cv-annotation-service';
import { logger } from '../lib/logger';
import { ProcessingStatus } from '@prisma/client';

export async function processImageJob(job: Job<{ imageId: string }>) {
  const { imageId } = job.data;
  const correlationId = `job-${job.id}`;

  logger.info({ correlationId, imageId, attempt: job.attemptsMade + 1 }, 'Starting image processing job');

  try {
    // 1. Update state to PROCESSING
    await prisma.image.update({
      where: { id: imageId },
      data: {
        status: ProcessingStatus.PROCESSING,
        retryCount: job.attemptsMade,
      },
    });

    // 2. Fetch image metadata & load buffer
    const image = await prisma.image.findUniqueOrThrow({
      where: { id: imageId },
    });

    const buffer = await storageService.readFile(image.storedPath);
    const sharpMeta = await sharp(buffer).metadata();

    const imageInputMeta = {
      width: sharpMeta.width || 0,
      height: sharpMeta.height || 0,
      format: sharpMeta.format || 'unknown',
    };

    const results: (AnalyzerResult & { error: string | null; durationMs: number })[] = [];
    let extractedPhash: string | null = null;

    // 3. Execute Analyzer Pipeline sequentially with isolation per check
    for (const analyzer of analyzers) {
      const startTime = Date.now();
      try {
        logger.debug({ correlationId, imageId, analyzer: analyzer.name }, 'Running analyzer');
        const result = await analyzer.analyze(image.storedPath, buffer, imageInputMeta);
        const durationMs = Date.now() - startTime;

        if (result.checkName === 'duplicate_detection' && typeof result.details?.phash === 'string') {
          extractedPhash = result.details.phash;
        }

        results.push({
          ...result,
          error: null,
          durationMs,
        });

        // Immediately persist completed check to DB so real-time status API streams live check progress
        await prisma.analysisResult.upsert({
          where: {
            imageId_checkName: {
              imageId,
              checkName: result.checkName,
            },
          },
          create: {
            imageId,
            checkName: result.checkName,
            passed: result.passed,
            score: result.score,
            details: result.details as any,
            error: null,
            durationMs,
          },
          update: {
            passed: result.passed,
            score: result.score,
            details: result.details as any,
            error: null,
            durationMs,
          },
        }).catch((e) => logger.warn({ imageId, checkName: result.checkName, error: e }, 'Failed early upsert of check result'));

        logger.info(
          { correlationId, imageId, analyzer: analyzer.name, passed: result.passed, score: result.score, durationMs },
          'Analyzer completed'
        );
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

        logger.error({ correlationId, imageId, analyzer: analyzer.name, error: errorMessage }, 'Analyzer execution error');

        const failedResult = {
          checkName: analyzer.name,
          passed: false,
          score: null,
          details: { error: errorMessage },
          error: errorMessage,
          durationMs,
        };

        results.push(failedResult);

        await prisma.analysisResult.upsert({
          where: { imageId_checkName: { imageId, checkName: analyzer.name } },
          create: { imageId, checkName: analyzer.name, passed: false, score: null, details: { error: errorMessage } as any, error: errorMessage, durationMs },
          update: { passed: false, score: null, details: { error: errorMessage } as any, error: errorMessage, durationMs },
        }).catch(() => {});
      }
    }

    // 4. Generate Computer Vision Annotated Composite Image Overlay
    try {
      const absPath = storageService.getAbsPath(image.storedPath);
      const annotatedPath = path.join(path.dirname(absPath), `${imageId}_annotated.png`);

      const ocrRes = results.find((r) => r.checkName === 'ocr_plate_validation');
      const blurRes = results.find((r) => r.checkName === 'blur_detection');
      const metaRes = results.find((r) => r.checkName === 'metadata_analysis');

      // Always provide a bounding box: use OCR-detected box if available, otherwise estimate plate region
      let bbox = ocrRes?.details?.boundingBox as { left: number; top: number; width: number; height: number } | undefined;
      const imgW = sharpMeta.width || 800;
      const imgH = sharpMeta.height || 800;

      if (!bbox) {
        // Estimate plate search region based on orientation
        const isPortrait = imgH > imgW;
        bbox = isPortrait
          ? { left: Math.floor(imgW * 0.58), top: Math.floor(imgH * 0.60), width: Math.floor(imgW * 0.35), height: Math.floor(imgH * 0.14) }
          : { left: Math.floor(imgW * 0.55), top: Math.floor(imgH * 0.65), width: Math.floor(imgW * 0.40), height: Math.floor(imgH * 0.30) };
      }

      const cvData = {
        imageWidth: imgW,
        imageHeight: imgH,
        laplacianStdev: typeof blurRes?.details?.laplacianStdev === 'number' ? blurRes.details.laplacianStdev : undefined,
        plateBoundingBox: bbox,
        plateText: typeof ocrRes?.details?.normalizedPlate === 'string' ? ocrRes.details.normalizedPlate : undefined,
        isPlateValid: Boolean(ocrRes?.passed),
        hasGps: Boolean(metaRes?.details?.hasGps),
        latitude: typeof metaRes?.details?.latitude === 'number' ? metaRes.details.latitude : undefined,
        longitude: typeof metaRes?.details?.longitude === 'number' ? metaRes.details.longitude : undefined,
      };

      const annotatedBuffer = await CvAnnotationService.generateAnnotatedImage(absPath, cvData);
      await fs.writeFile(annotatedPath, annotatedBuffer);
      logger.info({ correlationId, imageId, annotatedPath }, 'Generated Computer Vision annotated composite overlay image');
    } catch (cvErr) {
      logger.warn({ correlationId, imageId, error: cvErr instanceof Error ? cvErr.message : cvErr }, 'Non-fatal error generating CV annotated image');
    }

    // 5. Atomic DB update of all analysis results and completion status
    await prisma.$transaction([
      ...results.map((r) =>
        prisma.analysisResult.upsert({
          where: {
            imageId_checkName: {
              imageId,
              checkName: r.checkName,
            },
          },
          create: {
            imageId,
            checkName: r.checkName,
            passed: r.passed,
            score: r.score,
            details: r.details as any,
            error: r.error,
            durationMs: r.durationMs,
          },
          update: {
            passed: r.passed,
            score: r.score,
            details: r.details as any,
            error: r.error,
            durationMs: r.durationMs,
          },
        })
      ),
      prisma.image.update({
        where: { id: imageId },
        data: {
          status: ProcessingStatus.COMPLETED,
          phash: extractedPhash || image.phash,
          processedAt: new Date(),
          failureReason: null,
        },
      }),
    ]);

    logger.info({ correlationId, imageId, totalChecks: results.length }, 'Image processing job completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Fatal pipeline error';
    logger.error({ correlationId, imageId, attempt: job.attemptsMade + 1, error: errorMessage }, 'Job execution encountered error');

    // If max retries reached or unrecoverable, mark image as FAILED in DB
    const maxAttempts = job.opts.attempts || 3;
    if (job.attemptsMade + 1 >= maxAttempts) {
      await prisma.image.update({
        where: { id: imageId },
        data: {
          status: ProcessingStatus.FAILED,
          failureReason: `Processing failed after ${maxAttempts} attempts: ${errorMessage}`,
        },
      });
      logger.error({ correlationId, imageId }, 'Max retries exhausted, image status set to FAILED');
    }

    throw error; // Rethrow so BullMQ manages retry state
  }
}
