export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  public existingId?: string;

  constructor(message: string, existingId?: string) {
    super(message, 409, 'DUPLICATE_UPLOAD');
    this.existingId = existingId;
  }
}

export class FileSizeError extends ValidationError {
  constructor(sizeBytes: number, maxBytes: number) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    super(`Selected file is ${sizeMb}MB, which exceeds the maximum limit of ${maxMb}MB. Please select a smaller image.`);
  }
}

export class FileTypeError extends ValidationError {
  constructor(mimeType: string) {
    super(`File format '${mimeType}' is not supported. Please upload a JPEG, PNG, or WebP vehicle image.`);
  }
}

export class PipelineProcessingError extends AppError {
  constructor(checkName: string, reason: string) {
    super(`Check '${checkName.replace(/_/g, ' ')}' failed: ${reason}`, 422, 'PIPELINE_CHECK_FAILED');
  }
}
