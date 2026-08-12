import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'VehicleIQ — Intelligent Media Processing Pipeline',
  description: 'Asynchronous backend image quality analysis & forensics platform built with Next.js, BullMQ, and PostgreSQL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-900 flex min-h-screen antialiased">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto w-full bg-slate-50 text-slate-900">
          {children}
        </main>
      </body>
    </html>
  );
}
