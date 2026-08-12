import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/services/image-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const status = await imageService.getStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error fetching status';
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: errorMessage },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: errorMessage },
      { status: 500 }
    );
  }
}
