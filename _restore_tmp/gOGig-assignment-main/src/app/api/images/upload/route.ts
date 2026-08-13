import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/services/image-service';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const idempotencyKey = (formData.get('idempotencyKey') as string | null) || request.headers.get('x-idempotency-key');

    if (!file) {
      return NextResponse.json(
        {
          error: 'MISSING_FILE',
          message: 'No image file was provided. Please select an image file under the "file" form field.',
        },
        { status: 400 }
      );
    }

    const result = await imageService.handleUpload(file, idempotencyKey);
    const statusCode = result.isDuplicateUpload ? 409 : 202;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn({ errorCode: error.errorCode, message: error.message }, 'Handled upload validation error');
      return NextResponse.json(
        {
          error: error.errorCode,
          message: error.message,
        },
        { status: error.statusCode }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Upload processing encountered an unexpected internal error.';
    logger.error({ error: errorMessage }, 'Unhandled upload route error');

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: `Upload error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
