// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  // Говорим Vite, что .wasm файлы — это ассеты (картинки/файлы), а не JS код
  assetsInclude: ['**/*.wasm'], 
  
  optimizeDeps: {
    // ВАЖНО: Мы убрали exclude. Теперь Vite сам исправит импорты.
    // Принудительно включаем обработку этих пакетов:
    include: ['@radr/shadowwire', 'buffer', 'process'],
  },
  
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3000',
    }
  }
});