'use client';

import React, { useEffect } from 'react';
import { QueryProvider } from '../src/providers/QueryProvider';
import { useAuthStore } from '../src/store/useAuthStore';
import { apiRequest } from '../src/services/api';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { currentUser, setAuth, logout } = useAuthStore.getState();
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token && !currentUser) {
      apiRequest('/auth/me')
        .then((user) => {
          setAuth(user, token);
        })
        .catch(() => {
          logout();
        });
    }
  }, []);

  return <QueryProvider>{children}</QueryProvider>;
}
