import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite plugin to route /admin/* cleanly to /admin/index.html
function adminRoutingPlugin() {
  return {
    name: 'admin-routing-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/admin') && !url.includes('.')) {
          req.url = '/admin/index.html';
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [adminRoutingPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      }
    }
  }
});
