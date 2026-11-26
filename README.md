# Play Online: Magnata do Cassino

Jogo de gerenciamento em 3D: construa e administre um resort cassino em andares, com dinheiro fictício (sem apostas reais nem compras).

- `npm run dev`: desenvolvimento
- `src/casino/data.ts`: salas, hóspedes, equipe, rivais e cidades (mude números aqui)
- `src/casino/sim.ts`: economia, missões, eventos, salvamento e renda com o app fechado
- `src/casino/scene.ts`: cenário 3D (three.js)
- Mod menu: senha só na variável `ADMIN_PIN` da Vercel, conferida em `api/admin.ts`
