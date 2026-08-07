'use client';

import React from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-extrabold text-rose-500 mb-2">500 — System Error</h1>
      <p className="text-xs text-slate-400 mb-6 font-medium">An unexpected clinical application error occurred.</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition"
      >
        Try Again
      </button>
    </div>
  );
}
