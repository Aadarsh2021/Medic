'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { AppShell } from '../../src/components/AppShell';
import { PharmacyView } from '../../src/views/PharmacyView';

export default function PharmacyPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
    }
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <AppShell>
      <PharmacyView />
    </AppShell>
  );
}
