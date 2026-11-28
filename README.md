# Play Online: Magnata Fitness

Jogo de gerenciamento em 3D: comece com uma academia de bairro, alugue os salões vizinhos do galpão e crie uma rede de academias pelo Ceará. Economia em reais, como na vida real (sem compras).

- `npm run dev`: desenvolvimento
- `src/gym/data.ts`: salões, zonas, preços em R$, salários, alunos, rivais e cidades (mude números aqui)
- `src/gym/sim.ts`: mensalidades, custos do mês, alunos que entram e saem, rede, objetivos e dias com o app fechado
- `src/gym/scene.ts`: galpão 3D (three.js); `machines.ts`: aparelhos; `people.ts`: alunos articulados e as poses de cada exercício
- `node scripts/test-gym.mjs`: joga a partida inteira sozinho e mostra o ritmo e as contas de cada ano
- Mod menu: senha só na variável `ADMIN_PIN` da Vercel, conferida em `api/admin.ts`
