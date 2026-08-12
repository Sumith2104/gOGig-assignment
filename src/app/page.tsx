'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileImage,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Zap,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { formatBytes, timeAgo } from '@/lib/utils';

interface ImageItem {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  processedAt: string | null;
  failureReason: string | null;
  summary: {
    totalChecks: number;
    passed: number;
    score: number;
  };
}

export default function DashboardPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/images?limit=10');
      if (res.ok) {
        const json = await res.json();
        setImages(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(), 5000);
    return () => clearInterval(interval);
  }, []);

  const total = images.length;
  const pending = images.filter((i) => i.status === 'PENDING').length;
  const processing = images.filter((i) => i.status === 'PROCESSING').length;
  const completed = images.filter((i) => i.status === 'COMPLETED').length;
  const failed = images.filter((i) => i.status === 'FAILED').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pipeline Overview</h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Real-time monitoring for vehicle image processing & automated quality checks
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-sm transition-all duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-orange-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/upload"
            className="btn-orange flex items-center space-x-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Upload Vehicle Image</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-orange-500 border border-slate-200 relative overflow-hidden bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total Uploads</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : total}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <FileImage className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-4">Async Queue Storage</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-amber-500 border border-slate-200 relative overflow-hidden bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Processing</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : pending + processing}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 animate-spin" />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-4">
            {pending} pending · {processing} active worker
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-slate-200 relative overflow-hidden bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Completed</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : completed}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-4">
            {total > 0 ? `${Math.round((completed / total) * 100)}% success rate` : 'No batches yet'}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-rose-500 border border-slate-200 relative overflow-hidden bg-white shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Failed / Flagged</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : failed}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-4">Isolated error handling</p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Recent Ingestion Stream</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Latest vehicle images processed asynchronously</p>
          </div>
          <Link
            href="/images"
            className="flex items-center space-x-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
          >
            <span>View All Images</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm font-semibold animate-pulse flex items-center justify-center space-x-2">
            <Activity className="w-4 h-4 text-orange-600 animate-spin" />
            <span>Loading recent upload queue...</span>
          </div>
        ) : images.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <FileImage className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-slate-600 text-sm font-medium">No vehicle images uploaded yet.</p>
            <Link
              href="/upload"
              className="btn-orange inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-white text-xs font-bold"
            >
              <span>Upload First Image</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider">
                  <th className="pb-3 px-3">Filename</th>
                  <th className="pb-3 px-3">Size</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Checks Passed</th>
                  <th className="pb-3 px-3">Uploaded</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {images.map((img) => (
                  <tr key={img.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 px-3 font-bold text-slate-900 flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                        <FileImage className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="truncate max-w-[200px]" title={img.originalName}>
                        {img.originalName}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-slate-700 font-semibold text-xs">{formatBytes(img.fileSize)}</td>
                    <td className="py-4 px-3">
                      {img.status === 'COMPLETED' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Completed
                        </span>
                      )}
                      {img.status === 'PROCESSING' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                          Processing...
                        </span>
                      )}
                      {img.status === 'PENDING' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800 border border-orange-300">
                          Pending
                        </span>
                      )}
                      {img.status === 'FAILED' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-xs font-bold text-slate-900">
                      {img.status === 'COMPLETED' ? (
                        <span className="text-emerald-700 font-extrabold">
                          {img.summary.passed} / {img.summary.totalChecks} Checks
                        </span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-slate-500 font-medium text-xs">{timeAgo(img.createdAt)}</td>
                    <td className="py-4 px-3 text-right">
                      <Link
                        href={`/images/${img.id}`}
                        className="inline-flex items-center space-x-1 text-xs font-extrabold text-orange-600 group-hover:text-orange-700 hover:underline"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analyzer Pipeline Overview Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-200 bg-white space-y-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Integrated Analyzer Engine (6 Checks)</h3>
            <p className="text-xs text-slate-500 font-medium">Isolated execution with deterministic fallbacks & heuristic validation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wider">1. Blur Detection</span>
            <p className="text-xs text-slate-800 font-medium mt-1">Sharp Laplacian 3x3 convolution with 5x5 matrix fallback</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wider">2. Brightness Analysis</span>
            <p className="text-xs text-slate-800 font-medium mt-1">Mean luminance inspection with RGB luminance sampling fallback</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wider">3. Duplicate Hash</span>
            <p className="text-xs text-slate-800 font-medium mt-1">64-bit dHash perceptual hashing with Hamming distance query</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wider">4. OCR & Plate Validation</span>
            <p className="text-xs text-slate-800 font-medium mt-1">Tesseract.js engine + Indian vehicle plate fuzzy regex correction</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wider">5. Dimension Bounds</span>
            <p className="text-xs text-slate-800 font-medium mt-1">Sharp resolution bounds, megapixel count & aspect ratio checks</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wider">6. EXIF Metadata</span>
            <p className="text-xs text-slate-800 font-medium mt-1">ExifReader inspection for camera make, GPS, software & anomalies</p>
          </div>
        </div>
      </div>
    </div>
  );
}
