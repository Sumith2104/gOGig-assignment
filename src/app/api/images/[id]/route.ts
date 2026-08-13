import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/services/image-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting: 20 deletes per minute per IP
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(clientIp, 'delete');

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Delete rate limit exceeded. Maximum ${rateLimit.limit} deletes per minute.`,
          retryAfterSeconds: rateLimit.resetInSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      );
    }

    const { id } = params;
    const result = await imageService.deleteImage(id);
    return NextResponse.json(result, {
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error deleting image';
    return NextResponse.json(
      { error: 'DELETE_FAILED', message: errorMessage },
      { status: 500 }
    );
  }
}

