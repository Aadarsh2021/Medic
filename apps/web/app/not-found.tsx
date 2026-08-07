'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-extrabold text-teal-400 mb-2">404 — Page Not Found</h1>
      <p className="text-xs text-slate-400 mb-6 font-medium">The requested clinical workspace or record route does not exist.</p>
      <Link
        href="/dashboard"
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition inline-block"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
