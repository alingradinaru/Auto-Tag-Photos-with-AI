import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // This exposes process.env.API_KEY to your client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});