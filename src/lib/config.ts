import path from 'path';

export const config = {
  // Database (AWS RDS / Local PostgreSQL)
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/media_pipeline?schema=public',

  // Queue & In-Memory Store (AWS ElastiCache / Redis)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // AWS S3 & Cloud Storage Credentials (Env Only)
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  s3BucketName: process.env.AWS_S3_BUCKET_NAME || '',

  // AI Vision & Model Credentials (Env Only)
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Server & Local Directory Fallbacks
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

