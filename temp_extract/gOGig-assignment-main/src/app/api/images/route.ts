import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/services/image-service';
import { ProcessingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const statusParam = searchParams.get('status')?.toUpperCase() as ProcessingStatus | undefined;

    const validStatus = statusParam && Object.values(ProcessingStatus).includes(statusParam) ? statusParam : undefined;

    const result = await imageService.listImages(page, limit, validStatus);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error listing images';
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: errorMessage },
      { status: 500 }
    );
  }
}
