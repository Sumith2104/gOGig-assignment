import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/services/image-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = await imageService.retryProcessing(id);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error re-queuing job';
    return NextResponse.json(
      { error: 'RETRY_FAILED', message: errorMessage },
      { status: 500 }
    );
  }
}
