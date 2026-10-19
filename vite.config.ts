import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/NodosEducativos/',
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/firestore.integration.test.ts'] },
});
