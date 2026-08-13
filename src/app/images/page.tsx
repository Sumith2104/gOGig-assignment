'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileImage,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  Layers,
} from 'lucide-react';
import { formatBytes, timeAgo } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export default function GalleryPage() {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const statusQuery = filterStatus !== 'ALL' ? `&status=${filterStatus}` : '';
      const res = await fetch(`/api/images?page=${page}&limit=12${statusQuery}`);
      if (res.ok) {
        const json = await res.json();
        setImages(json.data || []);
        setPagination(json.pagination || { totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch image gallery:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [page, filterStatus]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/images/${deleteTarget.id}`, { method: 'DELETE' });
      fetchImages();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filteredImages = images.filter((img) =>
    img.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Image Analysis Gallery</h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">Browse, filter and inspect uploaded vehicle images and quality metrics</p>
      </div>

      {/* Filter Toolbar with Greyed Selected Block State */}
      <div className="card-3d p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0">
          {['ALL', 'COMPLETED', 'PROCESSING', 'PENDING', 'FAILED'].map((status) => {
            const isActive = filterStatus === status;
            return (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status);
                  setPage(1);
                }}
                className={`px-4 py-2 text-xs font-black uppercase transition-all ${
                  isActive
                    ? 'grey-block-active shadow-md'
                    : 'grey-block-neutral'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 border-none rounded-none pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-500 text-sm font-semibold animate-pulse flex flex-col items-center justify-center space-y-3">
          <Activity className="w-8 h-8 text-slate-900 animate-spin" />
          <span>Loading gallery records...</span>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="py-24 card-3d text-center space-y-3 bg-white">
          <FileImage className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-600 text-sm font-medium">No images found matching filter specifications.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImages.map((img) => (
            /* Full Block Image Card with Glassmorphism Overlays directly on top */
            <div
              key={img.id}
              className="card-3d group relative flex flex-col justify-between overflow-hidden bg-slate-950 shadow-md hover:shadow-2xl transition-all h-[360px]"
            >
              {/* Full Edge-to-Edge Image Canvas */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/images/${img.id}/annotated`}
                alt={img.originalName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `/api/images/${img.id}/file`;
                }}
              />

              {/* Glassmorphism Top Badges Overlay */}
              <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10 gap-2">
                <div className="flex flex-col space-y-1">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md bg-slate-950/80 text-slate-100 border border-slate-700 shadow-sm">
                    {img.mimeType?.split('/')[1] || 'img'} • {formatBytes(img.fileSize)}
                  </span>
                  {img.summary?.campaignBrand && (
                    <span className="px-2.5 py-1 text-[10px] font-black backdrop-blur-md bg-slate-950/90 text-amber-400 border border-amber-500/60 shadow-sm max-w-[190px] truncate" title={img.summary.campaignBrand}>
                      BRAND: {img.summary.campaignBrand}
                    </span>
                  )}
                  {img.summary?.normalizedPlate && (
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold backdrop-blur-md bg-slate-950/90 text-emerald-300 border border-emerald-500/60 shadow-sm">
                      PLATE: {img.summary.normalizedPlate}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  {img.status === 'COMPLETED' && (
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md bg-emerald-950/80 text-emerald-200 border border-emerald-700">
                      Completed
                    </span>
                  )}
                  {img.status === 'PROCESSING' && (
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md bg-amber-950/80 text-amber-200 border border-amber-700 animate-pulse">
                      Processing
                    </span>
                  )}
                  {img.status === 'PENDING' && (
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md bg-slate-900/80 text-slate-200 border border-slate-700">
                      Pending
                    </span>
                  )}
                  {img.status === 'FAILED' && (
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md bg-rose-950/80 text-rose-200 border border-rose-700">
                      Flagged
                    </span>
                  )}
                </div>
              </div>

              {/* Glassmorphism Bottom Action Bar Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent space-y-2.5">
                <div>
                  <h3 className="font-extrabold text-white text-sm truncate" title={img.originalName}>
                    {img.originalName}
                  </h3>
                  <p className="text-[10px] text-slate-300 font-mono flex items-center gap-2 mt-0.5">
                    <span>ID: {img.id.substring(0, 8)}...</span>
                    <span>•</span>
                    <span>{timeAgo(img.createdAt)}</span>
                  </p>
                </div>

                {/* Glassmorphism Button Controls directly on card */}
                <div className="flex items-center space-x-2 pt-1">
                  <Link
                    href={`/images/${img.id}`}
                    className="flex-1 px-3 py-2 backdrop-blur-md bg-slate-900/90 hover:bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center space-x-2 border border-slate-700 transition-all shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-orange-400" />
                    <span>Inspect Analysis</span>
                  </Link>

                  <button
                    onClick={() => setDeleteTarget({ id: img.id, name: img.originalName })}
                    className="p-2 backdrop-blur-md bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 transition-all"
                    title="Delete Image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {pagination.totalPages > 1 && (
        <div className="card-3d p-4 bg-white flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Page {page} of {pagination.totalPages} ({pagination.total} Total Uploads)
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Image Record"
        message={`Are you sure you want to delete '${deleteTarget?.name}'?`}
        confirmLabel="Delete Image"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
