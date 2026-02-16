import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: '@/components',
        replacement: path.resolve(__dirname, './@/components')
      },
      {
        find: '@/lib',
        replacement: path.resolve(__dirname, './@/lib')
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, './src/client')
      },
      {
        find: '@shared',
        replacement: path.resolve(__dirname, './src/shared')
      }
    ],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8484',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    sourcemap: true,
  },
});
