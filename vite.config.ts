import { defineConfig } from 'vite';

// base: './' 로 두면 GitHub Pages 하위 경로에서도 그대로 돈다
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 6000 },
});
