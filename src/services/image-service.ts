import crypto from 'crypto';
import fileType from 'file-type';
import { prisma } from '../lib/db';
import { imageQueue } from '../lib/queue';
import { storageService } from './storage-service';
import { config } from '../lib/config';
import { logger } from '../lib/logger';
import { ProcessingStatus } from '@prisma/client';
import { FileSizeError, FileTypeError, NotFoundError } from '../lib/errors';

export class ImageService {
  async handleUpload(file: File, clientKey?: string | null) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. File Size Validation
    if (buffer.length > config.maxFileSize) {
      throw new FileSizeError(buffer.length, config.maxFileSize);
    }

    // 2. MIME Type Validation (Magic Bytes Inspection)
    const detectedType = await fileType.fromBuffer(buffer);
    const mimeType = detectedType ? detectedType.mime : file.type;

    if (!config.allowedMimeTypes.includes(mimeType)) {
      throw new FileTypeError(mimeType);
    }

    // 3. Idempotency Key Handling
    const idempotencyKey =
      clientKey && clientKey.trim() !== ''
        ? clientKey
        : crypto.createHash('sha256').update(buffer).update(file.name).digest('hex');

    const existingImage = await prisma.image.findUnique({
      where: { idempotencyKey },
    });

    if (existingImage) {
      if (existingImage.status === ProcessingStatus.COMPLETED) {
        logger.info({ imageId: existingImage.id, idempotencyKey }, 'Duplicate upload prevented by idempotency key');
        return {
          id: existingImage.id,
          status: existingImage.status,
          message: 'This exact image file was already uploaded previously and completed.',
          isDuplicateUpload: true,
          links: {
            status: `/api/images/${existingImage.id}/status`,
            results: `/api/images/${existingImage.id}/results`,
          },
        };
      }

      // If existing image is PENDING or FAILED, auto re-enqueue job in BullMQ
      await prisma.image.update({
        where: { id: existingImage.id },
        data: { status: ProcessingStatus.PENDING, failureReason: null, retryCount: 0 },
      });

      await imageQueue.add('process', { imageId: existingImage.id }, { jobId: existingImage.id });

      logger.info({ imageId: existingImage.id, idempotencyKey }, 'Re-queued incomplete image job in BullMQ');
      return {
        id: existingImage.id,
        status: ProcessingStatus.PENDING,
        message: 'Re-queued image job for background processing.',
        isDuplicateUpload: true,
        links: {
          status: `/api/images/${existingImage.id}/status`,
          results: `/api/images/${existingImage.id}/results`,
        },
      };
    }

    // 4. Save File to Storage
    const id = crypto.randomUUID();
    const ext = detectedType ? detectedType.ext : file.name.split('.').pop() || 'jpg';
    const storedPath = await storageService.saveFile(id, ext, buffer);

    // 5. Create Database Record
    const image = await prisma.image.create({
      data: {
        id,
        originalName: file.name,
        storedPath,
        fileSize: buffer.length,
        mimeType,
        idempotencyKey,
        status: ProcessingStatus.PENDING,
      },
    });

    // 6. Enqueue BullMQ Job
    await imageQueue.add(
      'process',
      { imageId: image.id },
      {
        jobId: image.id,
      }
    );

    logger.info({ imageId: image.id, originalName: file.name }, 'Image upload successful, job queued');

    return {
      id: image.id,
      status: image.status,
      message: 'Image uploaded successfully. Processing queued in background worker.',
      isDuplicateUpload: false,
      links: {
        status: `/api/images/${image.id}/status`,
        results: `/api/images/${image.id}/results`,
      },
    };
  }

  async getStatus(id: string) {
    const image = await prisma.image.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
      },
    });

    if (!image) {
      throw new NotFoundError(`No image record found matching ID '${id}'. Please verify the ID.`);
    }

    const processingTimeMs = image.processedAt
      ? image.processedAt.getTime() - image.createdAt.getTime()
      : null;

    return {
      id: image.id,
      status: image.status,
      failureReason: image.failureReason,
      createdAt: image.createdAt,
      processedAt: image.processedAt,
      processingTimeMs,
    };
  }

  async getResults(id: string) {
    const image = await prisma.image.findUnique({
      where: { id },
      include: {
        analysisResults: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!image) {
      throw new NotFoundError(`No analysis results found matching ID '${id}'. Please verify the ID.`);
    }

    const totalChecks = image.analysisResults.length;
    const passed = image.analysisResults.filter((r) => r.passed).length;
    const failed = image.analysisResults.filter((r) => !r.passed && !r.error).length;
    const errored = image.analysisResults.filter((r) => r.error !== null).length;
    const overallQualityScore = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) / 100 : 0;

    const processingTimeMs = image.processedAt
      ? image.processedAt.getTime() - image.createdAt.getTime()
      : null;

    return {
      id: image.id,
      originalName: image.originalName,
      storedPath: image.storedPath,
      imageUrl: `/api/images/${image.id}/file`,
      annotatedUrl: `/api/images/${image.id}/annotated`,
      fileSize: image.fileSize,
      mimeType: image.mimeType,
      status: image.status,
      storageVerified: true,
      failureReason: image.failureReason,
      createdAt: image.createdAt,
      processedAt: image.processedAt,
      processingTimeMs,
      summary: {
        totalChecks,
        passed,
        failed,
        errored,
        overallQualityScore,
      },
      analysisResults: image.analysisResults.map((r) => ({
        checkName: r.checkName,
        passed: r.passed,
        score: r.score,
        details: r.details,
        error: r.error,
        durationMs: r.durationMs,
      })),
    };
  }

  async listImages(page = 1, limit = 20, status?: ProcessingStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [total, data] = await Promise.all([
      prisma.image.count({ where }),
      prisma.image.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          analysisResults: {
            select: {
              checkName: true,
              passed: true,
              score: true,
              error: true,
            },
          },
        },
      }),
    ]);

    const formattedData = data.map((img) => {
      const totalChecks = img.analysisResults.length;
      const passed = img.analysisResults.filter((r) => r.passed).length;
      return {
        id: img.id,
        originalName: img.originalName,
        imageUrl: `/api/images/${img.id}/file`,
        fileSize: img.fileSize,
        mimeType: img.mimeType,
        status: img.status,
        storageVerified: true,
        failureReason: img.failureReason,
        createdAt: img.createdAt,
        processedAt: img.processedAt,
        summary: {
          totalChecks,
          passed,
          score: totalChecks > 0 ? Math.round((passed / totalChecks) * 100) / 100 : 0,
        },
      };
    });

    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async retryProcessing(id: string) {
    const image = await prisma.image.findUnique({ where: { id } });
    if (!image) {
      throw new Error(`Image record '${id}' not found.`);
    }

    await prisma.image.update({
      where: { id },
      data: { status: ProcessingStatus.PENDING, failureReason: null, retryCount: 0 },
    });

    await imageQueue.add('process', { imageId: id }, { jobId: `${id}-${Date.now()}` });

    logger.info({ imageId: id }, 'Manually re-queued image processing job');
    return {
      id,
      status: ProcessingStatus.PENDING,
      message: 'Job successfully re-queued for processing.',
    };
  }

  async deleteImage(id: string) {
    const image = await prisma.image.findUnique({ where: { id } });
    if (!image) {
      throw new Error(`Image record '${id}' not found.`);
    }

    // 1. Remove file from storage
    await storageService.deleteFile(image.storedPath);

    // 2. Remove BullMQ queue job if exists
    try {
      const job = await imageQueue.getJob(id);
      if (job) {
        await job.remove();
      }
    } catch {
      // Ignore if job missing from queue
    }

    // 3. Delete database record (cascade deletes analysisResults)
    await prisma.image.delete({ where: { id } });

    logger.info({ imageId: id }, 'Deleted image record and associated files');
    return {
      id,
      message: 'Image record and stored file deleted successfully.',
    };
  }
}

export const imageService = new ImageService();
