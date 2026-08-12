import path from 'path';

export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vehicle_iq?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};
