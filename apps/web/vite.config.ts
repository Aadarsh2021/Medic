import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/hospitals': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/appointments': 'http://localhost:3001',
      '/medical-records': 'http://localhost:3001',
      '/prescriptions': 'http://localhost:3001',
      '/lab-orders': 'http://localhost:3001',
      '/medicines': 'http://localhost:3001',
      '/invoices': 'http://localhost:3001',
      '/analytics': 'http://localhost:3001',
      '/notifications': 'http://localhost:3001',
    },
  },
});
