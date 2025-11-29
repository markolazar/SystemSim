import path, { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite';
import react from '@vitejs/plugin-react';

// Export config as a function so we can access the Vite `mode` and load .env
export default defineConfig(({ mode }) => {
  // Load the environment variables based on the mode
  let env;
  const envPath = mode === 'production'
    ? path.resolve(process.resourcesPath || __dirname) // Fallback to __dirname in case resourcesPath is undefined
    : __dirname;

  env = loadEnv(mode, envPath);

  // Prefer VITE_ prefixed vars for client exposure. Fallback to PORT.
  const frontendPort = parseInt(env.VITE_FRONTEND_PORT);

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
        },
      },
      // Configure dev server port for the renderer (Vite).
      server: {
        port: frontendPort,
      },
      plugins: [react()],
      define: {
        'process.env': env,
      },
    },
  };
});
