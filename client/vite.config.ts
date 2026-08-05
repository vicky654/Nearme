import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'vite-runtime';
          if (id.includes('node_modules/@ionic')) return 'ionic-runtime';
          if (id.includes('node_modules/ionicons')) return 'icons-runtime';
          const capacitorPackage = id.match(/node_modules\/@capacitor\/([^/]+)/)?.[1];
          if (capacitorPackage) return `capacitor-${capacitorPackage}`;
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'react-runtime';
          if (id.includes('node_modules/@tanstack') || id.includes('node_modules/axios') || id.includes('node_modules/zustand')) return 'data-runtime';
          if (id.includes('node_modules/framer-motion')) return 'motion-runtime';
        },
      },
    },
  },
});
