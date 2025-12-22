
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Ensure process.env.API_KEY is available to the browser
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    // Fallback for process.env to prevent ReferenceErrors
    'process': {
      env: {
        API_KEY: JSON.stringify(process.env.API_KEY)
      }
    }
  }
});
