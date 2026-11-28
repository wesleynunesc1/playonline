# Play Online: Magnata Fitness

Jogo de gerenciamento em 3D: comece com uma academia pequena, cresça em andares e crie uma rede de academias pelo Ceará (dinheiro fictício, sem compras).

- `npm run dev`: desenvolvimento
- `src/gym/data.ts`: salas, alunos, equipe, rivais e cidades (mude números aqui)
- `src/gym/sim.ts`: economia, missões, eventos, salvamento e renda com o app fechado
- `src/gym/scene.ts`: cenário 3D (three.js)
- `node scripts/test-gym.mjs`: joga a partida inteira sozinho e mostra o ritmo (ajuste em `TUNE`, no `data.ts`)
- Mod menu: senha só na variável `ADMIN_PIN` da Vercel, conferida em `api/admin.ts`
