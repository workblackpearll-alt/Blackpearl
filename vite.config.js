import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

// Vite plugin to route multi-page apps cleanly without .html
function pageRoutingPlugin() {
  const routes = ['admin', 'book', 'gallery', 'about', 'contact', 'terms', 'privacy', 'cancellation', 'verify'];
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

// Dev only: runs the Vercel functions in /api on the local server, so bookings
// work on localhost. Server secrets from .env stay on the Node side (never sent
// to the browser). Not used in production builds.
function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      server.middlewares.use(async (req, res, next) => {
        const match = (req.url || '').match(/^\/api\/([a-z0-9-]+)(?:\?(.*))?$/i);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
          req.query = Object.fromEntries(new URLSearchParams(match[2] || ''));
          await mod.default(req, res);
        } catch (err) {
          console.error(`[local api] /api/${match[1]}`, err);
          if (!res.headersSent) {
            res.statusCode = err.code === 'ERR_LOAD_URL' ? 404 : 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Local API error' }));
          }
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [localApiPlugin(), pageRoutingPlugin()],
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
        verify: resolve(__dirname, 'verify/index.html'),
        notFound: resolve(__dirname, '404.html')
      }
    }
  }
});
