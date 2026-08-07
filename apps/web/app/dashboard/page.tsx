'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { AppShell } from '../../src/components/AppShell';
import { DashboardView } from '../../src/views/DashboardView';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
    }
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
