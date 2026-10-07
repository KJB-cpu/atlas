import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Viewer3D 청크(three.js 포함)는 지연 로딩되므로 크기 경고 기준 완화
  build: { chunkSizeWarningLimit: 900 },
});
