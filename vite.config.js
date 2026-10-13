import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite plugin to route /admin/* and /book/* cleanly
function pageRoutingPlugin() {
  return {
    name: 'page-routing-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/admin') && !url.includes('.')) {
          req.url = '/admin/index.html';
        } else if (url.startsWith('/book') && !url.includes('.')) {
          req.url = '/book/index.html';
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [pageRoutingPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        book: resolve(__dirname, 'book/index.html')
      }
    }
  }
});
