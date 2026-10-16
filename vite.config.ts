import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
export default defineConfig({
  base: './',
  plugins: [wasm()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, rollupOptions: { output: { manualChunks(id: string) { if (id.includes('node_modules/three')) return 'three'; if (id.includes('rapier')) return 'rapier'; } } } },
});
