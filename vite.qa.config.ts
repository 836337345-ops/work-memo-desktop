import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Test server only: Rust compilation creates locked files under src-tauri/.
// Excluding that tree avoids a Windows file-watcher crash during browser QA.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
});
