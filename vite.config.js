import { defineConfig } from 'vite';

function expressApiPlugin() {
    return {
        name: 'express-api-plugin',
        async configureServer(server) {
            const express = (await import('express')).default;
            const { apiRouter } = await import('./server/apiRouter.js');
            const app = express();
            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));
            app.use('/api', apiRouter);

            server.middlewares.use((req, res, next) => {
                if (req.url === '/admin' || req.url === '/admin.html' || req.url === '/smarty-staff-desk-919-m4q2' || req.url === '/smarty-staff-desk-919-m4q2.html') {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/html');
                    return res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>');
                }
                if (req.url === '/smarty-secure-master-911-k8x7') {
                    req.url = '/smarty-secure-master-911-k8x7.html';
                }
                if (req.url === '/smarty-ops-terminal-744-v9z2') {
                    req.url = '/smarty-ops-terminal-744-v9z2.html';
                }
                if (req.url.startsWith('/api/') || req.url === '/api' || req.url === '/ping' || req.url === '/healthz') {
                    if (req.url === '/ping' || req.url === '/healthz') {
                        req.url = '/api' + req.url;
                    }
                    return app(req, res, next);
                }
                next();
            });
        }
    };
}

export default defineConfig({
    plugins: [expressApiPlugin()],
    build: {
        rollupOptions: {
            input: {
                main: './index.html',
                superAdmin: './smarty-secure-master-911-k8x7.html',
                staffAdmin: './smarty-ops-terminal-744-v9z2.html',
                login: './login.html',
                profile: './profile.html',
                payment: './payment.html',
                checkin: './checkin.html',
                referral: './referral.html'
            }
        }
    },
    server: {
        port: 3000,
        host: '0.0.0.0'
    },
    preview: {
        port: 3000,
        host: '0.0.0.0'
    }
});

