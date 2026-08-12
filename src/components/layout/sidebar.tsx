'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UploadCloud, Images, Activity, Cpu } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Upload Image', href: '/upload', icon: UploadCloud },
    { name: 'Image Gallery', href: '/images', icon: Images },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0 shrink-0 shadow-sm">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center shadow-sm">
            <Cpu className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="font-black text-xl text-black tracking-tight flex items-center gap-1">
              Vehicle<span className="text-orange-600">IQ</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Media Processing Engine</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm'
                    : 'text-slate-700 hover:text-black hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-orange-600' : 'text-slate-500'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 m-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
          <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span className="text-emerald-700 font-extrabold">Worker Active</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium">BullMQ + Redis Engine</p>
      </div>
    </aside>
  );
}
