import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite plugin to route multi-page apps cleanly without .html
function pageRoutingPlugin() {
  const routes = ['admin', 'book', 'gallery', 'about', 'contact', 'terms', 'privacy', 'cancellation'];
  return {
    name: 'page-routing-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        for (const route of routes) {
          if ((url === `/${route}` || url.startsWith(`/${route}/`) || url.startsWith(`/${route}?`)) && !url.includes('.')) {
            const query = url.includes('?') ? url.substring(url.indexOf('?')) : '';
            req.url = `/${route}/index.html${query}`;
            return next();
          }
        }
        if (url === '/refund' || url.startsWith('/refund?') || url.startsWith('/refund/')) {
          const query = url.includes('?') ? url.substring(url.indexOf('?')) : '';
          req.url = `/cancellation/index.html${query}`;
          return next();
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
        book: resolve(__dirname, 'book/index.html'),
        gallery: resolve(__dirname, 'gallery/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        contact: resolve(__dirname, 'contact/index.html'),
        terms: resolve(__dirname, 'terms/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        cancellation: resolve(__dirname, 'cancellation/index.html'),
        notFound: resolve(__dirname, '404.html')
      }
    }
  }
});
