import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Em desenvolvimento, atende /api/* com as mesmas funções da Vercel */
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api', async (req, res, next) => {
      const name = /^\/(admin)$/.exec(req.url ?? '')?.[1];
      if (!name) return next();
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const { POST } = await server.ssrLoadModule(`/api/${name}.ts`);
      const out: Response = await POST(new Request(`http://localhost/api/${name}`, { method: 'POST', body: Buffer.concat(chunks) }));
      res.statusCode = out.status;
      res.setHeader('content-type', 'application/json');
      res.end(await out.text());
    });
  },
});

export default defineConfig({
  plugins: [react(), devApi()],
  server: { port: 3000, host: true },
  build: { chunkSizeWarningLimit: 900 }, // three.js sozinho passa de 500 kB
});
