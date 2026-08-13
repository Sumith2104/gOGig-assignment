'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileImage,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Sun,
  Camera,
  Layers,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (selectedFile: File) => {
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Invalid file format. Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setElapsedSeconds(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok && res.status !== 409) {
        throw new Error(data.message || 'Upload failed');
      }

      setUploadedImageId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  // Timer for processing elapsed time
  useEffect(() => {
    if (!uploadedImageId || processingStatus?.status === 'COMPLETED' || processingStatus?.status === 'FAILED') {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [uploadedImageId, processingStatus?.status]);

  useEffect(() => {
    if (!uploadedImageId) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/images/${uploadedImageId}/results`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setProcessingStatus(data);
            if (data.status === 'COMPLETED' || data.status === 'FAILED') {
              clearInterval(pollInterval);
            }
          }
        }
      } catch (err) {
        console.error('Status polling error:', err);
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [uploadedImageId]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Upload Vehicle Image</h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Ingest vehicle photos for asynchronous quality checks, OCR plate extraction, and forensic verification
        </p>
      </div>

      {/* Guidelines Instructions Section for Optimal Inspection Quality */}
      {!uploadedImageId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-3d p-4 space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>1. Clear Lighting & Contrast</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              Capture photos in well-lit daylight or illuminated night conditions. Avoid extreme dark shadows across license plates.
            </p>
          </div>

          <div className="card-3d p-4 space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>2. 2-5m Distance & Steady Focus</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              Keep phone camera steady to prevent motion blur (Laplacian score &gt; 10.0) and frame the full rear/front vehicle bumper.
            </p>
          </div>

          <div className="card-3d p-4 space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs">
              <Layers className="w-4 h-4 text-orange-600" />
              <span>3. Commercial 2-Line Yellow Plates</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              For auto-rickshaws and commercial taxis, ensure both yellow panel lines (e.g. MH12K + R1145) are fully visible in frame.
            </p>
          </div>
        </div>
      )}

      {!uploadedImageId ? (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`card-3d p-10 text-center transition-all duration-300 bg-white ${
              file ? 'bg-slate-50 border-2 border-slate-900' : 'hover:bg-slate-50'
            }`}
          >
            {previewUrl ? (
              <div className="space-y-4">
                <div className="relative w-52 h-52 mx-auto overflow-hidden shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-slate-900 font-black text-sm">{file?.name}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{file && formatBytes(file.size)}</p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-rose-600 hover:underline font-bold"
                >
                  Change Selected Image
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-slate-900 flex items-center justify-center mx-auto text-white shadow-md">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-slate-900 font-extrabold text-base">
                    Drag & drop your vehicle image here, or{' '}
                    <label className="text-orange-600 hover:underline cursor-pointer font-black">
                      browse
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Supported Formats: JPEG, PNG, WebP (Max 10MB)</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border-l-4 border-l-rose-600 text-rose-700 text-xs font-bold flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-orange flex items-center space-x-2 px-6 py-3 text-white font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Uploading to Ingestion Pipeline...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Ingest & Run Inspection</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="card-3d p-8 space-y-6 bg-white">
          {/* Header with Live Processing Timer */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-6 gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-slate-900 flex items-center justify-center text-white shadow-md">
                <FileImage className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">{file?.name || 'Uploaded Image'}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  ID: <span className="text-slate-900 font-bold">{uploadedImageId}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Real-time Timer Badge */}
              <div className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-mono font-bold flex items-center space-x-2 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                <span>Elapsed: {elapsedSeconds}s</span>
              </div>

              {processingStatus?.status === 'COMPLETED' && (
                <span className="px-3.5 py-1.5 text-xs font-extrabold bg-emerald-900 text-emerald-100 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pipeline Completed
                </span>
              )}
              {processingStatus?.status === 'PROCESSING' && (
                <span className="px-3.5 py-1.5 text-xs font-extrabold bg-amber-900 text-amber-100 flex items-center gap-1.5 animate-pulse shadow-sm">
                  <Clock className="w-4 h-4 animate-spin text-amber-400" /> Analyzing...
                </span>
              )}
              {processingStatus?.status === 'FAILED' && (
                <span className="px-3.5 py-1.5 text-xs font-extrabold bg-rose-900 text-rose-100 flex items-center gap-1.5 shadow-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Pipeline Flagged
                </span>
              )}
              {(!processingStatus || processingStatus?.status === 'PENDING') && (
                <span className="px-3.5 py-1.5 text-xs font-extrabold bg-slate-800 text-slate-100 shadow-sm">
                  Queued in Worker
                </span>
              )}
            </div>
          </div>

          {/* Sleek Slide-Up Animated Stage Ticker Feed (No cheap loader bar) */}
          {processingStatus?.status !== 'COMPLETED' && processingStatus?.status !== 'FAILED' && (
            <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> Live Pipeline Execution Stream
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Elapsed: {elapsedSeconds}s
                </span>
              </div>

              {/* Animated Slide-Up Ticker Card Item */}
              {(() => {
                const passedCount = processingStatus?.analysisResults?.length || 0;
                let currentStageText = 'File Ingestion & Metadata Inspection';
                let estTimeText = '~7s remaining';

                if (passedCount >= 5) {
                  currentStageText = 'Compositing Computer Vision Feature Map Overlay';
                  estTimeText = '~1s remaining';
                } else if (passedCount >= 4) {
                  currentStageText = 'Invoking Gemini Vision AI & License Plate OCR';
                  estTimeText = '~2s remaining';
                } else if (passedCount >= 3) {
                  currentStageText = '64-bit Perceptual Hash Duplicate Scanning';
                  estTimeText = '~4s remaining';
                } else if (passedCount >= 2) {
                  currentStageText = 'Pixel Brightness & Exposure Sampling';
                  estTimeText = '~5s remaining';
                } else if (passedCount >= 1) {
                  currentStageText = 'Blur & Laplacian Edge Contrast Analysis';
                  estTimeText = '~6s remaining';
                }

                return (
                  <div className="h-11 relative overflow-hidden flex items-center">
                    <div
                      key={passedCount}
                      className="w-full flex items-center justify-between bg-slate-950/80 px-4 py-2.5 border-l-4 border-l-amber-500 border border-slate-800 shadow-sm transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                        <span className="text-xs font-bold text-slate-100 tracking-wide">
                          ⚡ {currentStageText}...
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-orange-400 bg-slate-900 px-2.5 py-1 border border-slate-800">
                        {estTimeText}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Live Check Lifecycle</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'blur_detection',
                'brightness_analysis',
                'duplicate_detection',
                'ocr_plate_validation',
                'dimension_validation',
                'metadata_analysis',
              ].map((checkName) => {
                const res = processingStatus?.analysisResults?.find((r: any) => r.checkName === checkName);

                return (
                  <div
                    key={checkName}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      res
                        ? res.passed
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-rose-50/50 border-rose-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {res ? (
                        res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-900 capitalize">
                        {checkName.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold">
                      {res ? (
                        res.passed ? (
                          <span className="text-emerald-700 font-black">PASSED</span>
                        ) : (
                          <span className="text-rose-700 font-black">FLAGGED</span>
                        )
                      ) : (
                        <span className="text-slate-400 italic">Processing...</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {processingStatus?.status === 'FAILED' && (
            <div className="pt-4 space-y-4">
              {processingStatus?.failureReason && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold space-y-1">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Processing Failure Notice</span>
                  </div>
                  <p className="text-slate-700 font-medium pl-6">{processingStatus.failureReason}</p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={async () => {
                    try {
                      await fetch(`/api/images/${uploadedImageId}/retry`, { method: 'POST' });
                      setProcessingStatus((prev: any) => ({ ...prev, status: 'PENDING' }));
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="btn-orange flex items-center space-x-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Re-run Pipeline</span>
                </button>
              </div>
            </div>
          )}

          {processingStatus?.status === 'COMPLETED' && (
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => router.push(`/images/${uploadedImageId}`)}
                className="btn-orange flex items-center space-x-2 px-6 py-3 rounded-xl text-white font-bold text-sm"
              >
                <span>Inspect Detailed Analysis</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
