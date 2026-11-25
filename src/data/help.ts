/** Guia "Como jogar", em linguagem bem simples. Ao mudar uma regra do jogo, revise o texto aqui. */
export interface HelpTopic { icon: string; title: string; short: string; lines: string[]; tip?: string }
export interface HelpGroup { title: string; topics: HelpTopic[] }

export const HELP: HelpGroup[] = [
  {
    title: '👶 Comece por aqui',
    topics: [
      {
        icon: '🌍', title: 'O que é este jogo?', short: 'Você manda em um país e tenta dominar o mundo.',
        lines: [
          'Você escolhe um país. Ele ganha dinheiro sozinho, o tempo todo.',
          'Com o dinheiro você compra soldados e melhora o país.',
          'Com os soldados você ataca outros países. Se ganhar, o país vira seu e também passa a dar dinheiro.',
          'Mais países = mais dinheiro = mais soldados = mais países. É isso!',
        ],
      },
      {
        icon: '🚀', title: 'Seus primeiros 5 minutos', short: 'Siga estes passos, um por um.',
        lines: [
          '1. No menu, toque em PARTIDA LIVRE e escolha o Brasil. Toque em "Liderar esta nação".',
          '2. No mapa, os países com contorno AMARELO são os que você alcança. Toque em um deles.',
          '3. Toque em "Sugerir" e depois em "Atacar". Se a barra estiver VERDE, você deve ganhar.',
          '4. Na batalha, se não souber o que fazer, toque em "Resolver automático".',
          '5. Ganhou? Toque no país novo e construa uma 🏭 Fábrica para ganhar mais dinheiro.',
          '6. Acabaram os soldados? Toque em ⚔️ Exército e compre mais. Repita!',
        ],
        tip: 'Perdido? Leia a frase com 🎯 no topo do mapa: ela sempre diz o próximo passo.',
      },
      {
        icon: '👀', title: 'O que é cada coisa na tela?', short: 'Os números de cima e os botões de baixo.',
        lines: [
          'Em cima: a bandeira com o número de países, 💰 dinheiro e quanto ganha por segundo, ⚔️ força do exército, 🔬 ciência, e 🛢️⛏️🌽☢️ recursos.',
          'No canto esquerdo: poderes e velocidade (1x, 2x, 5x). O botão ⏸ pausa o jogo.',
          'No canto direito: aproximar, afastar e voltar para o seu país.',
          'Embaixo: os menus. Império é dinheiro, Exército é soldado, Aliados é amizade e briga, Ciência é invenção.',
          'No mapa: arraste com o dedo para andar e use dois dedos para dar zoom.',
        ],
      },
      {
        icon: '🎨', title: 'O que são as cores do mapa?', short: 'Azul é seu. Amarelo dá para atacar.',
        lines: [
          'Azul: é seu. 👑 é a sua capital.',
          'Contorno amarelo: você consegue atacar agora.',
          'Outras cores fortes: são dos impérios rivais.',
          'Sem cor: país sozinho, sem dono. São os mais fáceis.',
          'Contorno vermelho: seu país vai ser atacado. Corra!',
          'Mancha preta: houve guerra ali. Mancha verde: bomba nuclear.',
        ],
      },
    ],
  },
  {
    title: '⚔️ Guerra',
    topics: [
      {
        icon: '🗡️', title: 'Como atacar', short: 'Toque no país, escolha as tropas e ataque.',
        lines: [
          'Toque no país inimigo e arraste as barrinhas para escolher quantas tropas mandar.',
          '"Sugerir" escolhe por você. "Tudo" manda todo mundo.',
          'Olhe a porcentagem: verde é bom, amarelo é arriscado, vermelho é quase certeza de perder.',
          'Dá para fazer vários ataques ao mesmo tempo! As batalhas entram em fila para você comandar.',
          'O mundo não para enquanto você luta: fique de olho nos avisos.',
          'Quem você manda pode morrer. Não mande tudo, ou sua casa fica desprotegida!',
        ],
      },
      {
        icon: '✊', title: 'A batalha é pedra, papel e tesoura', short: 'Cada tática ganha de uma e perde de outra.',
        lines: [
          '⚔️ Avançar ganha de quem RECUA.',
          '↪️ Flanquear ganha de quem AVANÇA.',
          '🪤 Recuar e atrair ganha de quem FLANQUEIA.',
          'O jogo dá um palpite do que o inimigo vai fazer. Escolha a tática que ganha dela.',
          'O palpite pode errar. Espiões e a habilidade Estratégia do general fazem ele acertar mais.',
          'Está perdendo? Toque em 🏳️ Retirada e salve quem sobrou.',
        ],
      },
      {
        icon: '🪖', title: 'Os 4 tipos de tropa', short: 'Cada uma é boa contra outra.',
        lines: [
          '🪖 Infantaria: barata. Boa contra aviões. Gasta comida.',
          '🛡️ Blindado: forte. Bom contra infantaria. Gasta ferro.',
          '✈️ Aéreo: muito forte. Bom contra blindados. Gasta petróleo.',
          '🚢 Naval: leva tropas pelo mar. Cada navio carrega 20. Gasta ferro e petróleo.',
        ],
        tip: 'Antes de atacar, veja "Exército inimigo" e mande o que ganha dele.',
      },
      {
        icon: '🚫', title: 'Por que não consigo atacar?', short: 'As causas mais comuns.',
        lines: [
          '"Fora de alcance": o país não é vizinho. Conquiste um mais perto, construa portos ⚓ ou use 🪂 Paraquedistas.',
          '"Envie mais navios": pelo mar, cada navio leva só 20 tropas.',
          '"Trégua": vocês prometeram não brigar por um tempo. Espere acabar.',
          '"É seu aliado": você precisa trair na aba Aliados antes. Mas todos vão ficar bravos.',
        ],
      },
      {
        icon: '🛡️', title: 'Estão me atacando! E agora?', short: 'Você tem 25 segundos para se defender.',
        lines: [
          'Aparece um aviso vermelho com o nome do país e a sua chance de defesa.',
          'Toque em "+10 guarda" várias vezes para pôr soldados lá.',
          'Ou toque em 🛡️: o escudo anula o ataque inteiro.',
          'Perdeu o país? Calma, dá para reconquistar.',
        ],
      },
      {
        icon: '💥', title: 'Poderes especiais', short: 'Ajudas fortes que precisam recarregar.',
        lines: [
          '💣 Bombardeio: tira 30% da defesa do inimigo. Use antes de atacar.',
          '🛡️ Escudo: anula a próxima invasão.',
          '🪂 Paraquedistas: o próximo ataque chega em qualquer lugar.',
          '🛰️ Olho Total: mostra os planos dos inimigos por 60 segundos.',
          '☢️ Nuclear: destrói quase tudo. Precisa da Era Moderna e de 20 de urânio, e o mundo passa a te odiar.',
          '⛓️ Cercar: deixa o vizinho sem comida até ele se render, sem batalha. Custa dinheiro por segundo.',
        ],
      },
      {
        icon: '🎖️', title: 'Generais e baús', short: 'Heróis que deixam seus ataques mais fortes.',
        lines: [
          'Abra 🎁 baús na aba Generais. Eles dão generais, equipamentos ou dinheiro.',
          'Escolha um general na hora de atacar. Ele ganha experiência e fica mais forte.',
          'O 🎖️ estado-maior tem 3 vagas. Alguns pares juntos dão bônus.',
          'Se você perder, o general pode ser preso. Pague o resgate ou conquiste o país onde ele está.',
          'Ganhe baús com missões, níveis, vitórias e entrando todo dia.',
        ],
      },
    ],
  },
  {
    title: '💰 Dinheiro e país',
    topics: [
      {
        icon: '🏗️', title: 'Como ficar rico', short: 'Construa, negocie e conquiste.',
        lines: [
          'Toque em um país SEU para construir.',
          '📈 Economia e 🏭 Fábrica: mais dinheiro naquele país. Comece por elas!',
          '🏦 Banco: mais dinheiro em todo o império. 🔬 Laboratório: mais ciência.',
          '🏰 Quartel: soldados mais baratos. ⚓ Porto: alcança mais longe pelo mar.',
          '🚛 Rota comercial: toque em um país sem dono, aba Diplomacia. Dá dinheiro sem guerra.',
          'Domine um continente inteiro e ganhe 25% a mais nele.',
        ],
        tip: 'Se o dinheiro por segundo ficar vermelho, você está no prejuízo: exército grande também custa.',
      },
      {
        icon: '🛢️', title: 'Recursos e mercado', short: 'Petróleo, ferro, comida e urânio.',
        lines: [
          'Cada país produz um recurso. Você precisa deles para fazer tropas.',
          'Faltou? Compre no mercado, na aba Império.',
          'Seta ▲ vermelha: está caro. Seta ▼ verde: está barato. Compre barato e venda caro!',
          'Com 60% dos países de um recurso você vira dono do monopólio: produz o dobro.',
        ],
      },
      {
        icon: '😊', title: 'Povo feliz ou revoltado', short: 'Imposto alto deixa o povo bravo.',
        lines: [
          'Imposto alto dá mais dinheiro, mas o povo fica triste.',
          'Felicidade abaixo de 25%: o país pode se rebelar e você o perde.',
          'Para melhorar: baixe os impostos, vire Democracia ou construa maravilhas.',
        ],
      },
      {
        icon: '🏦', title: 'Empréstimos', short: 'Dinheiro agora, dívida depois.',
        lines: [
          'O banco empresta, mas cobra juros por segundo.',
          'Se a dívida ficar grande demais, você vai à FALÊNCIA: perde metade do exército.',
          'Novo no jogo? Melhor não pegar empréstimo.',
        ],
      },
      {
        icon: '🔬', title: 'Ciência e eras', short: 'Invenções que deixam tudo melhor.',
        lines: [
          'A ciência 🔬 junta sozinha. Gaste na aba Ciência.',
          'Alguns caminhos se bloqueiam: se for longe em um, fecha o outro. O jogo avisa.',
          'Avançar de ERA deixa o exército muito mais forte: de lanceiros até naves espaciais.',
        ],
      },
    ],
  },
  {
    title: '🤝 Amigos e inimigos',
    topics: [
      {
        icon: '😡', title: 'Quem são os rivais?', short: 'Líderes do computador que também querem o mundo.',
        lines: [
          'Cada um tem um jeito: agressivo, traidor, comerciante ou pacífico.',
          'O número ao lado do nome é o quanto gostam de você. Verde é bom, vermelho é ruim.',
          'Eles lembram do que você fez!',
          'Tome a CAPITAL de um rival e o império inteiro dele desmorona. Mas ele pode voltar querendo vingança.',
        ],
      },
      {
        icon: '🕊️', title: 'Como fazer amizade', short: 'Presente, tratado, trégua e aliança.',
        lines: [
          '🎁 Presente: aumenta a amizade.',
          '📜 Tratado: com 10 de amizade, os dois ganham dinheiro.',
          '🕊️ Trégua: ninguém ataca ninguém por 3 minutos. Ótimo para respirar.',
          '🤝 Aliança: com 50 de amizade, vocês não brigam.',
          'Cuidado com os traidores: eles podem te apunhalar.',
        ],
      },
      {
        icon: '😠', title: 'Má fama', short: 'Atacar muito deixa o mundo contra você.',
        lines: [
          'Cada ataque, traição ou bomba aumenta a má fama 😠.',
          'Se chegar a 65, todos se juntam contra você na COALIZÃO.',
          'Ela baixa sozinha com o tempo. Pare de atacar um pouco e construa.',
        ],
      },
      {
        icon: '🕵️', title: 'Ganhar países sem guerra', short: 'Compre, ameace ou espione.',
        lines: [
          '🧾 Comprar: pague e o país sem dono é seu.',
          '📣 Ultimato: ameace. Se seu exército for bem maior, ele pode se render.',
          '🤲 Vassalagem: ele continua livre, mas te paga metade do que ganha.',
          '🎭 Golpe de Estado: seus espiões derrubam o governo. É difícil, mas não tem batalha.',
        ],
      },
    ],
  },
  {
    title: '🏆 Ganhar e continuar',
    topics: [
      {
        icon: '👑', title: 'Como eu ganho o jogo?', short: 'Existem 4 jeitos na partida livre.',
        lines: [
          '⚔️ Militar: tenha 70 países, ou 40 sem nenhum rival de pé.',
          '💰 Econômica: tenha $ 500 mil guardados e ganhe $ 1.500 por segundo.',
          '🕊️ Diplomática: depois de 8 minutos, seja aliado de todos os rivais vivos (pelo menos 3).',
          '🚀 Científica: chegue a Marte.',
          'Veja quanto falta na aba 🌍 Mundo.',
        ],
      },
      {
        icon: '💀', title: 'Como eu perco?', short: 'Só se ficar sem nenhum país.',
        lines: ['Se perder a capital, outra cidade vira a capital.', 'Você só perde quando ficar com zero países.', 'Com poucos países, voluntários aparecem para te ajudar a virar o jogo.'],
      },
      {
        icon: '✨', title: 'Nova Era (prestígio)', short: 'Recomeçar mais forte.',
        lines: ['Com 10 países ou uma vitória, você pode recomeçar ganhando pontos de legado.', 'Use os pontos em bônus que ficam para sempre, na aba 🎯 Missões.', 'O mundo fica um pouco mais difícil a cada vez.'],
      },
      {
        icon: '🎯', title: 'Missões e prêmios', short: 'Entre todo dia e ganhe.',
        lines: ['Missões do dia: 1 baú cada. Missões da semana: 3 baús cada.', '🔥 A sequência de dias dá baús. Se faltar um dia, ela só pausa.', '🦖 Toda semana há um chefão na aba Exército.'],
      },
      {
        icon: '💾', title: 'Meu jogo fica salvo?', short: 'Sim, sozinho, neste aparelho.',
        lines: ['Salva sozinho a cada poucos segundos. Use CONTINUAR no menu.', 'Enquanto está fora, você ainda ganha metade do dinheiro, por até 8 horas.', 'Vai trocar de celular? Toque em 💾 Levar meu progresso, no menu inicial, e copie o código.', 'Apagar os dados do navegador sem esse código faz perder o progresso.'],
      },
    ],
  },
  {
    title: '🎮 Outros modos',
    topics: [
      {
        icon: '📶', title: 'Jogar com amigos no Wi-Fi', short: '2 a 6 pessoas na mesma internet.',
        lines: [
          'Todos precisam estar no mesmo Wi-Fi e abrir este site.',
          'Um toca em "Criar sala". A sala aparece para os outros. Não apareceu? Digite o código de 4 letras.',
          'Cada um escolhe o país e toca em "Estou pronto!". Quem criou começa a partida.',
          'Todos veem os ataques de todos no mapa. As batalhas dos outros aparecem ao vivo em uma telinha: toque para ampliar.',
          'Use 🃏 cartas para ajudar você ou atrapalhar os outros, e 💬 para conversar.',
          'Se quem criou a sala sair, a partida acaba.',
        ],
      },
      {
        icon: '🪖', title: 'Guerra Ceará 2026', short: 'Mundo aberto 3D nas 184 cidades, sozinho ou com amigos.',
        lines: [
          'Jogue sozinho contra robôs ou crie uma sala: quem está no mesmo Wi-Fi vê a sala. Também dá para entrar com o código.',
          'Cada um toca no mapa e escolhe a cidade onde vai começar. Depois toca em "Estou pronto!".',
          'Arraste para andar pelo mapa. Com dois dedos, aproxime e gire.',
          'Toque em uma tropa sua para escolher. Toque duas vezes para pegar todas iguais por perto. ⬚ Área: desenhe um quadrado. 🪖 Todas: escolhe o exército inteiro.',
          'O mundo começa em paz e você decide tudo. Toque em uma cidade sua para construir, treinar e Evoluir: ela cresce de verdade no mapa.',
          '🤝 Toque em uma cidade neutra perto da sua e escolha Trazer por acordo. Ela entra sem guerra.',
          'Acordos: proponha comércio, depois aliança. Cada um rende +8%. Guerra só depois de um ultimato de 30 segundos.',
          '🏡 Há 5 eras, de Vilarejo à Era Atômica. Cada uma libera construções, tropas e armas. Toque em Era para avançar.',
          'Robôs Pacíficos nunca começam guerra. Equilibrados só tarde. Agressivos mais cedo. Sempre avisam antes.',
          'Com tropas escolhidas, toque no chão para andar. Em cidade neutra o jogo pergunta se é para atacar.',
          'Tomar cidade: zere a defesa e deixe infantaria, moto, blindado ou tanque no centro por 4 segundos.',
          'Sem tropas escolhidas, toque em uma cidade sua para construir e treinar.',
          '💰 Dinheiro vem das cidades e do comércio. ⛽ Combustível vem das refinarias e usinas: veículos e aviões precisam dele.',
          'O escuro é onde você não enxerga. Drone Espião, Radar e 🛰️ Satélite mostram o inimigo.',
          'Quem ganha de quem: antitanque e FPV destroem tanques; tanque e artilharia destroem infantaria; antiaérea derruba aviões e drones.',
          '🚀 Arsenal: escolha e toque no mapa. Cuidado, bombas também machucam você.',
          '☢️ Nuclear: pesquise o Programa Nuclear e construa um Silo em cidade tamanho 5. Há 3 bombas. O lugar fica com radiação. O Domo Antimíssil derruba 1 míssil por minuto.',
          '👑 Mais > Governo: escolha a doutrina, as políticas e os impostos. Povo revoltado expulsa você da cidade.',
          '🏆 Maravilhas: 10 obras únicas. Quem termina primeiro fica com o bônus.',
          '👁️ Em Acordos dá para espionar: vigiar, sabotar, copiar pesquisa e mais. Às vezes o espião é pego.',
          '📦 Caixas de suprimento caem no mapa. A primeira tropa que chega leva.',
          'Dilemas aparecem de tempos em tempos: cada resposta tem um preço.',
          'No Mundo Aberto há 4 caminhos para vencer: povo, dinheiro, ciência ou maravilhas.',
          'A partida solo é salva sozinha. Use Continuar no menu.',
          'Mais > Gabinete: ministros, constituição e objetivo secreto. Há eleição a cada 6 minutos: com povo infeliz você perde ministros.',
          'Mais > Bolsa, Mundo, Cidades e Enciclopédia: ações, mercador, pistas do tesouro, lista das cidades e comparação de tropas.',
          'Assembleia: todos votam propostas que mudam a partida.',
          'Litoral: construa um Estaleiro para ter navios. Lancha, blindado e helicóptero levam infantaria (Embarcar e Desembarcar).',
          'General e oficiais fortalecem quem está perto. Atacar por trás dói mais. Infantaria na cidade se protege.',
          'Menu: Campanha com 6 missões, Desafio do dia e Sobrevivência por ondas.',
          'Perigos do mundo (bandidos, chefes, meteoros) só aparecem se você ligar essa regra.',
          '🎯 Missões dão dinheiro e ensinam o caminho. ⭐ Tropas que destroem inimigos viram veteranas e ficam mais fortes.',
          '♾️ Em Treinar, escolha Sem parar para a cidade produzir sozinha.',
          'Dá para jogar com o celular em pé ou deitado.',
        ],
      },
      { icon: '📖', title: 'Campanha e cenários', short: 'Histórias e desafios prontos.', lines: ['Campanha: 6 capítulos com história e objetivo. Termine um para liberar o próximo.', 'Cenários: Guerra Fria, zumbis, alienígenas e sobrevivência.', 'O objetivo fica escrito no topo do mapa.'] },
      { icon: '🐍', title: 'Jogo da Cobra', short: 'Coma as frutas e não bata.', lines: ['Deslize o dedo ou use as setas para virar.', 'Coma as frutas para crescer. A estrela vale 50 pontos, mas some rápido!', 'Bater na parede ou em você mesmo acaba o jogo. Dá para desligar as paredes.'] },
    ],
  },
];

export const GLOSSARY: [string, string][] = [
  ['Aliado', 'Amigo. Vocês não se atacam.'],
  ['Baixas', 'Soldados que você perdeu.'],
  ['Capital', 'O país principal de um império.'],
  ['Cerco', 'Cercar um país até ele se render.'],
  ['Guarnição', 'Soldados que ficam protegendo um país.'],
  ['Má fama', 'O quanto o mundo está bravo com você.'],
  ['Moral', 'O ânimo dos soldados. Mais moral, mais força.'],
  ['Monopólio', 'Mandar em quase todo um recurso.'],
  ['Trégua', 'Combinado de não brigar por um tempo.'],
  ['Vassalo', 'País livre que te paga tributo.'],
  ['Veteranos', 'Soldados experientes, que lutam melhor.'],
];
