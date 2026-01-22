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
    port: 5173, // Стандартный порт Vite (можно оставить как есть)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000', // ИСПОЛЬЗУЕМ IP ВМЕСТО localhost
        changeOrigin: true,
        secure: false,
      },
    }
  },
});