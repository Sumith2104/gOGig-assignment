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
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [uploadedImageId]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Upload Vehicle Image</h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Ingest vehicle photos for asynchronous quality checks, OCR plate extraction, and forensic verification
        </p>
      </div>

      {!uploadedImageId ? (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`glass-panel p-10 rounded-2xl border-2 border-dashed text-center transition-all duration-300 bg-white ${
              file
                ? 'border-orange-500 bg-orange-50/50'
                : 'border-slate-300 hover:border-orange-500 hover:bg-slate-50'
            }`}
          >
            {previewUrl ? (
              <div className="space-y-4">
                <div className="relative w-48 h-48 mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-md">
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
                  Change Image
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto text-orange-600">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-slate-900 font-bold text-base">
                    Drag & drop your vehicle image here, or{' '}
                    <label className="text-orange-600 hover:underline cursor-pointer font-extrabold">
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
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-orange flex items-center space-x-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Ingest & Run Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl border border-slate-200 bg-white space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                <FileImage className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">{file?.name || 'Uploaded Image'}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  ID: <span className="font-mono text-slate-900 font-bold">{uploadedImageId}</span>
                </p>
              </div>
            </div>
            <div>
              {processingStatus?.status === 'COMPLETED' && (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pipeline Completed
                </span>
              )}
              {processingStatus?.status === 'PROCESSING' && (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse shadow-sm">
                  <Clock className="w-4 h-4 animate-spin text-amber-600" /> Processing Analyzers...
                </span>
              )}
              {processingStatus?.status === 'FAILED' && (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-600" /> Pipeline Failed
                </span>
              )}
              {(!processingStatus || processingStatus?.status === 'PENDING') && (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800 border border-orange-300 shadow-sm">
                  Queued in BullMQ
                </span>
              )}
            </div>
          </div>

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
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      {res ? (
                        res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        )
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 animate-spin" />
                      )}
                      <span className="text-xs font-bold text-slate-900 capitalize">
                        {checkName.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-slate-900">
                      {res ? (res.passed ? 'PASSED' : 'FLAGGED') : 'Pending'}
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
