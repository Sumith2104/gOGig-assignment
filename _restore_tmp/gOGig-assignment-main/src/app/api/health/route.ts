import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redisConnection } from '@/lib/redis';
import fs from 'fs/promises';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {
    database: 'unknown',
    redis: 'unknown',
    storage: 'unknown',
  };

  let isHealthy = true;

  // DB Check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch (err) {
    checks.database = `disconnected: ${err instanceof Error ? err.message : 'error'}`;
    isHealthy = false;
  }

  // Redis Check
  try {
    const pong = await redisConnection.ping();
    checks.redis = pong === 'PONG' ? 'connected' : `unexpected: ${pong}`;
    if (pong !== 'PONG') isHealthy = false;
  } catch (err) {
    checks.redis = `disconnected: ${err instanceof Error ? err.message : 'error'}`;
    isHealthy = false;
  }

  // Storage Check
  try {
    await fs.access(config.uploadDir);
    checks.storage = 'writable';
  } catch {
    try {
      await fs.mkdir(config.uploadDir, { recursive: true });
      checks.storage = 'writable';
    } catch (err) {
      checks.storage = `unwritable: ${err instanceof Error ? err.message : 'error'}`;
      isHealthy = false;
    }
  }

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
