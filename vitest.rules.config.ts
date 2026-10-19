import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/firestore.integration.test.ts'], testTimeout: 15000, hookTimeout: 30000 } });
