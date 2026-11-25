import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Em desenvolvimento, atende /api/lan com a mesma função da Vercel */
const lanApi = (): Plugin => ({
  name: 'lan-api',
  configureServer(server) {
    server.middlewares.use('/api/lan', async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const { POST } = await server.ssrLoadModule('/api/lan.ts');
      const out: Response = await POST(new Request('http://localhost/api/lan', { method: 'POST', body: Buffer.concat(chunks) }));
      res.statusCode = out.status;
      res.setHeader('content-type', 'application/json');
      res.end(await out.text());
    });
  },
});

export default defineConfig({
  plugins: [react(), lanApi()],
  server: { port: 3000, host: true },
});
