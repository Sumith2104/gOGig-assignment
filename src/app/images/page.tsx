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
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Image Analysis Gallery</h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">Browse, filter and inspect uploaded vehicle images and quality metrics</p>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 md:pb-0">
          {['ALL', 'COMPLETED', 'PROCESSING', 'PENDING', 'FAILED'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                filterStatus === status
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-black hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-500 text-sm font-semibold animate-pulse flex flex-col items-center justify-center space-y-3">
          <Activity className="w-8 h-8 text-orange-600 animate-spin" />
          <span>Loading gallery records...</span>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="py-24 glass-panel rounded-2xl text-center space-y-3 bg-white border border-slate-200 shadow-sm">
          <FileImage className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-600 text-sm font-medium">No images found matching filter specifications.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImages.map((img) => (
            <div
              key={img.id}
              className="glass-panel glass-panel-hover rounded-2xl border border-slate-200 p-5 space-y-4 flex flex-col justify-between bg-white shadow-sm hover:border-slate-300 transition-all"
            >
              <div className="space-y-3">
                <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/images/${img.id}/file`}
                    alt={img.originalName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-extrabold text-emerald-700 border border-emerald-300 shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Storage Verified
                  </div>
                  <div className="absolute top-3 right-3">
                    {img.status === 'COMPLETED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-300 backdrop-blur-sm shadow-sm">
                        Completed
                      </span>
                    )}
                    {img.status === 'PROCESSING' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100/90 text-amber-800 border border-amber-300 animate-pulse backdrop-blur-sm shadow-sm">
                        Processing
                      </span>
                    )}
                    {img.status === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-orange-100/90 text-orange-800 border border-orange-300 backdrop-blur-sm shadow-sm">
                        Pending
                      </span>
                    )}
                    {img.status === 'FAILED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100/90 text-rose-800 border border-rose-300 backdrop-blur-sm shadow-sm">
                        Failed
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm truncate" title={img.originalName}>
                    {img.originalName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{formatBytes(img.fileSize)}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">{timeAgo(img.createdAt)}</span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteTarget({ id: img.id, name: img.originalName });
                    }}
                    title="Delete Image Record"
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    href={`/images/${img.id}`}
                    className="inline-flex items-center space-x-1 text-xs font-extrabold text-orange-600 hover:text-orange-700 hover:underline"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-slate-600 font-medium">
            Showing Page <span className="text-slate-900 font-extrabold">{page}</span> of{' '}
            <span className="text-slate-900 font-extrabold">{pagination.totalPages}</span>
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Custom Blurred Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Image Record"
        message={`Are you sure you want to delete '${deleteTarget?.name || 'this image'}'? This action cannot be undone.`}
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
