'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { AuthView } from '../../src/views/AuthView';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken && currentUser) {
      router.push('/dashboard');
    }
  }, [accessToken, currentUser, router]);

  return <AuthView />;
}
