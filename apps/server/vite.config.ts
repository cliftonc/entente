import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: 'src/ui',
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          'localhost:3001': 'localhost:3000',
          '127.0.0.1:3001': 'localhost:3000',
          'localhost': 'localhost:3000'
        },
        cookiePathRewrite: {
          '/': '/'
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward all cookies from frontend to backend
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Rewrite Set-Cookie headers from backend to frontend domain
            const setCookies = proxyRes.headers['set-cookie'];
            if (setCookies) {
              console.log('🍪 Proxy: Original set-cookie headers:', setCookies);
              proxyRes.headers['set-cookie'] = setCookies.map(cookie => {
                // Remove domain restrictions and use path / for all cookies
                const rewritten = cookie
                  .replace(/Domain=localhost:3001;?/gi, '')
                  .replace(/Domain=127\.0\.0\.1:3001;?/gi, '')
                  .replace(/Domain=localhost;?/gi, '');
                console.log('🍪 Proxy: Rewritten cookie:', rewritten);
                return rewritten;
              });
            }
          });
        }
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          'localhost:3001': 'localhost:3000',
          '127.0.0.1:3001': 'localhost:3000',
          'localhost': 'localhost:3000'
        },
        cookiePathRewrite: {
          '/': '/'
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward all cookies from frontend to backend
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Rewrite Set-Cookie headers from backend to frontend domain
            const setCookies = proxyRes.headers['set-cookie'];
            if (setCookies) {
              console.log('🍪 Proxy: Original set-cookie headers:', setCookies);
              proxyRes.headers['set-cookie'] = setCookies.map(cookie => {
                // Remove domain restrictions and use path / for all cookies
                const rewritten = cookie
                  .replace(/Domain=localhost:3001;?/gi, '')
                  .replace(/Domain=127\.0\.0\.1:3001;?/gi, '')
                  .replace(/Domain=localhost;?/gi, '');
                console.log('🍪 Proxy: Rewritten cookie:', rewritten);
                return rewritten;
              });
            }
          });
        }
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/ui'),
      '@entente/types': path.resolve(__dirname, '../../packages/types/src'),
      '@entente/fixtures': path.resolve(__dirname, '../../packages/fixtures/src'),
    },
  },
})
