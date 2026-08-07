import React from 'react';
import type { Metadata } from 'next';
import '../src/index.css';
import { Providers } from './providers';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MedCore HMS — Multi-Tenant Enterprise Healthcare SaaS',
  description: 'Enterprise Hospital Management Platform with EMR, Pharmacy, Lab, and Billing automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-slate-950 text-slate-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
