import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storageService } from '@/services/storage-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const image = await prisma.image.findUnique({ where: { id } });

    if (!image) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const buffer = await storageService.readFile(image.storedPath);
    const mimeType = image.mimeType || 'image/png';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error serving file';
    return new NextResponse(`Storage Error: ${errorMessage}`, { status: 500 });
  }
}
