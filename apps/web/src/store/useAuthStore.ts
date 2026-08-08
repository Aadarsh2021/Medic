import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  currentUser: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

const customStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      accessToken: null,
      setAuth: (user: User, token: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', token);
        }
        set({ currentUser: user, accessToken: token });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
        }
        set({ currentUser: null, accessToken: null });
      },
    }),
    {
      name: 'medcore-auth-storage',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({ currentUser: state.currentUser, accessToken: state.accessToken }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && typeof window !== 'undefined') {
          localStorage.setItem('accessToken', state.accessToken);
        }
      },
    },
  ),
);
