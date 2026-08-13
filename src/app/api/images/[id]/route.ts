import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/services/image-service';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = await imageService.deleteImage(id);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error deleting image';
    return NextResponse.json(
      { error: 'DELETE_FAILED', message: errorMessage },
      { status: 500 }
    );
  }
}
