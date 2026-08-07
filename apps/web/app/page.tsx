'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../src/store/useAuthStore';
import { LandingView } from '../src/views/LandingView';

export default function RootPage() {
  const router = useRouter();
  const { currentUser, accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken && currentUser) {
      if (currentUser.role === 'PATIENT') {
        router.push('/patient-portal');
      } else if (currentUser.role === 'DOCTOR') {
        router.push('/doctor-portal');
      } else {
        router.push('/dashboard');
      }
    }
  }, [currentUser, accessToken, router]);

  return <LandingView onGoToAuth={() => router.push('/login')} />;
}
