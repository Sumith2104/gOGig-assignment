import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
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

    const absPath = storageService.getAbsPath(image.storedPath);
    const annotatedPath = path.join(path.dirname(absPath), `${id}_annotated.png`);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(annotatedPath);
    } catch {
      // Fallback to original file if annotated image not generated yet
      buffer = await storageService.readFile(image.storedPath);
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error serving file';
    return new NextResponse(`Storage Error: ${errorMessage}`, { status: 500 });
  }
}
