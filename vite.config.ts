
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the project root.
  // The third parameter '' allows loading variables without the VITE_ prefix.
  // Cast process to any to access cwd() in environments where Node types are not fully resolved in vite.config.ts
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Replace instances of process.env.API_KEY with the value from .env
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env to ensure it exists as an object in the browser
      'process.env': JSON.stringify({
        API_KEY: env.API_KEY
      }),
      // Some libraries might check 'global.process' or just 'process'
      'process': JSON.stringify({
        env: {
          API_KEY: env.API_KEY
        }
      })
    }
  };
});
