import { BlurDetector } from './blur-detector';
import { BrightnessAnalyzer } from './brightness-analyzer';
import { DuplicateDetector } from './duplicate-detector';
import { OcrPlateValidator } from './ocr-plate-validator';
import { DimensionValidator } from './dimension-validator';
import { MetadataAnalyzer } from './metadata-analyzer';
import type { Analyzer } from './types';

export const analyzers: Analyzer[] = [
  new BlurDetector(),
  new BrightnessAnalyzer(),
  new DuplicateDetector(),
  new OcrPlateValidator(),
  new DimensionValidator(),
  new MetadataAnalyzer(),
];

export * from './types';
