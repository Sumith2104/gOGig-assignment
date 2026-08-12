'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UploadCloud, Images, Activity } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Upload Image', href: '/upload', icon: UploadCloud },
    { name: 'Image Gallery', href: '/images', icon: Images },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 shrink-0 shadow-sm rounded-none">
      <div>
        {/* Clean Header: Vehicle IQ Media Processing Engine */}
        <div className="p-6 border-b border-slate-100">
          <h1 className="font-black text-lg text-slate-900 tracking-tight uppercase leading-snug">
            Vehicle IQ
          </h1>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            Media Processing Engine
          </p>
        </div>

        {/* Navigation Links with Greyed Selected Block State & Sharp Edges */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-none font-bold text-xs transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-700 hover:text-black hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 m-4 rounded-none bg-slate-100 border border-slate-200/80 space-y-1 shadow-sm">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
          <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span className="text-slate-900 font-extrabold uppercase tracking-wide">Worker Active</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium">BullMQ + Redis Engine</p>
      </div>
    </aside>
  );
}
