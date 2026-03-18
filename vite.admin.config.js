import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'static/admin',
  base: './',
  envDir: '../../',
  build: {
    outDir: 'build',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          atlaskit: [
            '@atlaskit/button',
            '@atlaskit/checkbox',
            '@atlaskit/css-reset',
            '@atlaskit/lozenge',
            '@atlaskit/section-message',
            '@atlaskit/spinner',
            '@atlaskit/tabs',
            '@atlaskit/textfield',
            '@atlaskit/toggle',
            '@atlaskit/tooltip',
          ],
          posthog: ['posthog-js', '@posthog/react'],
          'forge-bridge': ['@forge/bridge'],
        },
      },
    },
  },
});
