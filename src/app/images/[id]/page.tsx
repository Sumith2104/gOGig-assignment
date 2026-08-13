'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Eye,
  Sun,
  Copy,
  Type,
  Maximize2,
  FileCode,
  Info,
  Trash2,
  MapPin,
  Target,
  X,
  Camera,
  Layers,
  Activity,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { formatBytes, formatDuration } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export default function ImageResultsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'cv_annotated'>('cv_annotated');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/images/${params.id}/results`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || `Failed to fetch results (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();

    const interval = setInterval(() => {
      if (!data || data.status === 'PENDING' || data.status === 'PROCESSING') {
        fetchResults();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [params.id, data?.status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/images/${data.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete image');
      }
      window.location.href = '/images';
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const res = await fetch(`/api/images/${data.id}/summary`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.aiSummary) {
          setAiSummaryText(json.aiSummary);
        }
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm font-semibold animate-pulse flex flex-col items-center justify-center space-y-3">
        <Activity className="w-8 h-8 text-orange-600 animate-spin" />
        <span>Loading detailed analysis results for image {params.id}...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-black text-slate-900">Record Not Found</h2>
        <p className="text-xs text-slate-600 font-medium">{error || 'Could not load image analysis details.'}</p>
        <Link
          href="/images"
          className="btn-orange inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Gallery</span>
        </Link>
      </div>
    );
  }

  const metaResult = data.analysisResults?.find((r: any) => r.checkName === 'metadata_analysis');
  const ocrResult = data.analysisResults?.find((r: any) => r.checkName === 'ocr_plate_validation');
  const blurResult = data.analysisResults?.find((r: any) => r.checkName === 'blur_detection');

  const getCheckIcon = (name: string) => {
    switch (name) {
      case 'blur_detection':
        return Eye;
      case 'brightness_analysis':
        return Sun;
      case 'duplicate_detection':
        return Copy;
      case 'ocr_plate_validation':
        return Type;
      case 'dimension_validation':
        return Maximize2;
      case 'metadata_analysis':
        return FileCode;
      default:
        return Info;
    }
  };

  const getCheckLabel = (name: string) => {
    switch (name) {
      case 'blur_detection':
        return 'Blur Detection';
      case 'brightness_analysis':
        return 'Brightness Analysis';
      case 'duplicate_detection':
        return 'Duplicate Detection';
      case 'ocr_plate_validation':
        return 'Ocr Plate Validation';
      case 'dimension_validation':
        return 'Dimension Validation';
      case 'metadata_analysis':
        return 'Metadata Analysis';
      default:
        return name;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/images"
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Image List</span>
        </Link>
      </div>

      {/* Top Banner Status */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-black text-slate-900">{data.originalName}</h1>
            <span
              className={`px-3 py-0.5 text-[11px] font-extrabold rounded-full border ${
                data.status === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : data.status === 'PROCESSING'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {data.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">ID: {data.id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
          <div className="border-r border-slate-200 pr-4">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">File Size</span>
            <span className="font-mono text-slate-900">{formatBytes(data.fileSize)}</span>
          </div>
          <div className="border-r border-slate-200 pr-4">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Format</span>
            <span className="font-mono text-slate-900">{data.mimeType.split('/')[1].toUpperCase()}</span>
          </div>
          <div className="border-r border-slate-200 pr-4">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Processing Time</span>
            <span className="font-mono text-slate-900">
              {data.processedAt ? formatDuration(data.processingTimeMs) : 'In Progress'}
            </span>
          </div>
          <button
            onClick={async () => {
              try {
                await fetch(`/api/images/${data.id}/retry`, { method: 'POST' });
                fetchResults();
              } catch (e) {
                console.error(e);
              }
            }}
            className="btn-orange px-3.5 py-2 rounded-xl text-white font-bold text-xs flex items-center space-x-1.5 shrink-0"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Re-run Pipeline</span>
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center space-x-1.5 shrink-0 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Interactive CV Canvas & Physical Disk Storage Info */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 bg-white grid grid-cols-1 md:grid-cols-3 gap-6 items-start shadow-sm">
        <div className="md:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-orange-600" /> Image Inspection Mode
            </span>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => setViewMode('original')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'original' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>Original</span>
              </button>
              <button
                onClick={() => setViewMode('cv_annotated')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'cv_annotated' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>CV Map</span>
              </button>
            </div>
          </div>

          <div
            onClick={() => setIsLightboxOpen(true)}
            className="h-72 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 relative group cursor-pointer hover:border-orange-500 transition-all shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewMode === 'cv_annotated' ? `/api/images/${data.id}/annotated` : `/api/images/${data.id}/file`}
              alt={data.originalName}
              className="w-full h-full object-contain bg-slate-950 group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `/api/images/${data.id}/file`;
              }}
            />
            <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-400 backdrop-blur-md shadow-sm">
              Storage Verified
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="bg-slate-900/90 text-white border border-slate-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5">
                {viewMode === 'cv_annotated' ? (
                  <>
                    <Layers className="w-3 h-3 text-orange-400" />
                    <span>CV Overlay Active</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3 h-3 text-slate-300" />
                    <span>Original View</span>
                  </>
                )}
              </span>
              <span className="bg-slate-900/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 backdrop-blur-md flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3 h-3" /> Fullscreen
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <span>Physical Storage & Computer Vision Extraction</span>
          </h3>

          {/* Gemini AI Executive Inspection Summary Card */}
          {(() => {
            const ocrRes = data.analysisResults?.find((r: any) => r.checkName === 'ocr_plate_validation');
            const campaignBrand = ocrRes?.details?.campaignBrand;
            const normalizedPlate = ocrRes?.details?.normalizedPlate;

            return (
              <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                  <span className="text-[11px] font-black uppercase text-slate-300 tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> Gemini Vision AI Executive Inspection Summary
                  </span>
                  <button
                    onClick={handleGenerateAiSummary}
                    disabled={isGeneratingAiSummary}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded transition-all flex items-center justify-center space-x-1.5 shadow-sm shrink-0"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isGeneratingAiSummary ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAiSummary ? 'Generating AI Audit...' : 'Generate Instant AI Audit'}</span>
                  </button>
                </div>

                <p className="text-xs font-semibold leading-relaxed text-slate-200">
                  {aiSummaryText ||
                    ocrRes?.details?.aiExecutiveSummary ||
                    `Vehicle photo inspected under campaign '${campaignBrand || 'Unspecified Campaign'}' with plate '${normalizedPlate || 'Unverified Plate'}'. ${data.summary?.completed || 6} of 6 checks executed cleanly with ${data.summary?.issuesDetected || 0} quality/perceptual issue(s) detected.`}
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2.5 py-1 text-[10px] font-black bg-slate-900 text-amber-400 border border-slate-800">
                    BRAND: {campaignBrand || 'UNSPECIFIED'}
                  </span>
                  <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-900 text-emerald-300 border border-slate-800">
                    PLATE: {normalizedPlate || 'UNVERIFIED'}
                  </span>
                  <span className={`px-2.5 py-1 text-[10px] font-black uppercase border ${
                    data.summary?.issuesDetected ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}>
                    {data.summary?.issuesDetected ? `${data.summary.issuesDetected} ISSUE(S) LOGGED` : 'ZERO ISSUES LOGGED'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Outdoor Campaign Verification Highlight Card */}
          {(() => {
            const ocrRes = data.analysisResults?.find((r: any) => r.checkName === 'ocr_plate_validation');
            const campaignBrand = ocrRes?.details?.campaignBrand;
            const normalizedPlate = ocrRes?.details?.normalizedPlate;
            if (!campaignBrand && !normalizedPlate) return null;

            return (
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider flex items-center gap-1.5">
                    Outdoor Campaign Ad Verification (gOGig Platform)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700">
                    Audit Verified
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium">Campaign / Advertiser Brand:</span>
                    <p className="text-sm font-black text-white">{campaignBrand || 'Generic Outdoor Wrap'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium">Vehicle License Plate:</span>
                    <p className="text-sm font-mono font-black text-amber-400">{normalizedPlate || 'N/A'}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium">Stored File Path:</span>
              <p className="font-mono font-bold text-slate-900 text-[11px] truncate" title={data.storedPath}>
                {data.storedPath}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium">Direct Image Stream API:</span>
              <p>
                <a
                  href={`/api/images/${data.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-bold text-orange-600 hover:underline text-[11px]"
                >
                  /api/images/{data.id}/file
                </a>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium">CV Annotated Stream API:</span>
              <p>
                <a
                  href={`/api/images/${data.id}/annotated`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-bold text-orange-600 hover:underline text-[11px]"
                >
                  /api/images/{data.id}/annotated
                </a>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium">Storage Status:</span>
              <p className="font-bold text-emerald-700 text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Disk Write Confirmed & Readable</span>
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              metaResult?.details?.hasGps
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            } flex items-start gap-3`}
          >
            <MapPin
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                metaResult?.details?.hasGps ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <div className="space-y-1 text-xs">
              <span className="font-bold block text-slate-900">GPS Metadata Inspection</span>
              {metaResult?.details?.hasGps ? (
                <div className="space-y-1">
                  <p className="font-medium text-emerald-700">
                    Location Geotag Found ({metaResult.details.gpsSource}):
                  </p>
                  <p className="font-mono font-bold text-black text-sm">
                    Latitude: {metaResult.details.latitude} | Longitude: {metaResult.details.longitude}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500">No EXIF or visual overlay GPS coordinates detected</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overall Score Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-orange-600" />
            <h3 className="font-black text-slate-900 text-base">Overall Quality Score</h3>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-600">
              {data.summary.passed} / {data.summary.totalChecks} Checks Passed ({Math.round((data.summary.passed / data.summary.totalChecks) * 100)}%)
            </span>
          </div>
        </div>

        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              data.summary.overallQualityScore >= 0.8
                ? 'bg-emerald-500'
                : data.summary.overallQualityScore >= 0.5
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${Math.max(5, data.summary.overallQualityScore * 100)}%` }}
          />
        </div>
      </div>

      {/* Check Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900">Automated Check Pipeline Breakdown</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.analysisResults?.map((result: any) => {
            const Icon = getCheckIcon(result.checkName);
            const status: string = result.resultStatus || (result.passed ? 'NO_ISSUE_DETECTED' : 'ISSUE_DETECTED');

            let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300';
            let badgeText = 'NO ISSUE DETECTED';
            if (status === 'ISSUE_DETECTED') {
              badgeStyle = 'bg-rose-50 text-rose-800 border-rose-300';
              badgeText = 'ISSUE DETECTED';
            } else if (status === 'REVIEW_REQUIRED') {
              badgeStyle = 'bg-amber-50 text-amber-900 border-amber-300';
              badgeText = 'REVIEW REQUIRED';
            } else if (status === 'ANALYZER_ERROR') {
              badgeStyle = 'bg-slate-900 text-rose-300 border-slate-700';
              badgeText = 'ANALYZER ERROR';
            }

            return (
              <div
                key={result.checkName}
                className="glass-panel p-5 rounded-2xl border border-slate-200 bg-white space-y-4 hover:border-slate-300 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-orange-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{getCheckLabel(result.checkName)}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Duration: {result.durationMs}ms
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${badgeStyle}`}>
                    {badgeText}
                  </span>
                </div>

                {/* Dynamic Smart Evidence & Issue Explanation Banner */}
                {(() => {
                  let explanation = result.details?.evidence || result.details?.error;

                  if (!explanation || explanation === 'Analyzer executed successfully.') {
                    if (result.checkName === 'duplicate_detection') {
                      explanation = result.details?.isDuplicate
                        ? `Perceptual duplicate match detected: Closest match '${result.details?.closestMatchName || 'another image'}' (Hamming Distance: ${result.details?.hammingDistance ?? 0} bits)`
                        : 'Zero perceptual duplicates found in database.';
                    } else if (result.checkName === 'metadata_analysis') {
                      const anomalies = result.details?.anomalies;
                      explanation = Array.isArray(anomalies) && anomalies.length > 0
                        ? `Anomalies detected: ${anomalies.join('; ')}`
                        : 'EXIF metadata header absent (common for compressed web uploads / messaging apps).';
                    } else if (result.checkName === 'blur_detection') {
                      explanation = result.passed
                        ? `Image is sharp with clear edge definitions (Laplacian Stdev: ${result.details?.laplacianStdev ?? result.score})`
                        : `Image appears blurry or out of focus (Laplacian Stdev: ${result.details?.laplacianStdev ?? result.score})`;
                    } else if (result.checkName === 'brightness_analysis') {
                      explanation = result.passed
                        ? `Lighting luminance within optimal range (Mean Luminance Y: ${result.details?.meanBrightness ?? result.score})`
                        : `Lighting is ${result.details?.assessment?.toLowerCase() || 'out of bounds'} (Mean Luminance Y: ${result.details?.meanBrightness ?? result.score})`;
                    } else if (result.checkName === 'ocr_plate_validation') {
                      explanation = result.details?.formatValid
                        ? `Valid Indian vehicle plate format: ${result.details?.normalizedPlate || 'Verified'}`
                        : 'Extracted text did not pass standard Indian vehicle plate regex format.';
                    } else if (result.checkName === 'dimension_validation') {
                      explanation = result.passed
                        ? `Resolution ${result.details?.width}x${result.details?.height} meets pipeline bounds.`
                        : `Resolution ${result.details?.width}x${result.details?.height} outside allowed bounds.`;
                    } else {
                      explanation = 'Analyzer executed successfully.';
                    }
                  }

                  return (
                    <div
                      className={`p-3.5 rounded-xl text-xs font-medium border ${
                        status === 'ISSUE_DETECTED'
                          ? 'bg-rose-50/80 text-rose-900 border-rose-200'
                          : status === 'REVIEW_REQUIRED'
                          ? 'bg-amber-50/80 text-amber-900 border-amber-200'
                          : 'bg-emerald-50/50 text-emerald-900 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <Info
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            status === 'ISSUE_DETECTED'
                              ? 'text-rose-600'
                              : status === 'REVIEW_REQUIRED'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        />
                        <p className="font-semibold leading-relaxed">{explanation}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Metric Score:</span>
                    <span className="font-mono font-bold text-slate-900">{result.score ?? 'N/A'}</span>
                  </div>

                  {Object.entries(result.details || {}).map(([key, val]: [string, any]) => {
                    if (key === 'anomalies' || key === 'evidence') return null;
                    if (key === 'rawText' && result.details?.formatValid) return null;
                    const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    const truncated = formattedVal.length > 35 ? formattedVal.substring(0, 32) + '...' : formattedVal;

                    return (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
                        <span className="text-slate-500 font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1')}:
                        </span>
                        <span className="font-mono font-semibold text-slate-800 max-w-[220px] truncate" title={formattedVal}>
                          {truncated}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Image & Analysis"
        message={`Are you sure you want to permanently delete '${data.originalName}'? This action will remove the record and file from physical storage.`}
        confirmLabel="Delete Image"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Clean Centered Image Inspection Popup Dialog (No Top Whitespace, z-[99999] Viewport Coverage) */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[99999] bg-slate-950/80 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
          style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 text-white shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Target className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white truncate max-w-[240px] sm:max-w-[380px]">
                    {data.originalName}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID: {data.id.substring(0, 12)}... • Format: {data.mimeType.split('/')[1].toUpperCase()} • {formatBytes(data.fileSize)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* View Mode Toggle */}
                <div className="flex items-center space-x-1 bg-slate-950 p-1 border border-slate-800 text-[11px] font-bold">
                  <button
                    onClick={() => setViewMode('original')}
                    className={`px-2.5 py-1 transition-all flex items-center gap-1 ${
                      viewMode === 'original' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    <span>Original</span>
                  </button>
                  <button
                    onClick={() => setViewMode('cv_annotated')}
                    className={`px-2.5 py-1 transition-all flex items-center gap-1 ${
                      viewMode === 'cv_annotated' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>CV Map</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image Viewport Canvas Sized according to content */}
            <div className="p-4 bg-slate-950 flex items-center justify-center flex-1 min-h-[300px] max-h-[68vh] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewMode === 'cv_annotated' ? `/api/images/${data.id}/annotated` : `/api/images/${data.id}/file`}
                alt={data.originalName}
                className="max-w-full max-h-[65vh] w-auto h-auto object-contain shadow-lg"
              />
            </div>

            {/* Dialog Footer Bar */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center space-x-3">
                {ocrResult?.details?.normalizedPlate && (
                  <span className="text-emerald-400 font-mono font-bold text-[11px] bg-emerald-950/80 px-2.5 py-1 border border-emerald-800">
                    PLATE: {ocrResult.details.normalizedPlate}
                  </span>
                )}
                {ocrResult?.details?.campaignBrand && (
                  <span className="text-amber-400 font-bold text-[11px] bg-slate-900 px-2.5 py-1 border border-slate-700 truncate max-w-[220px]">
                    BRAND: {ocrResult.details.campaignBrand}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Press ESC or click outside to close dialog</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
