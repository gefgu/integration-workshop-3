import type { TourStep } from '../components/Tour.tsx';

const nav = (path: string) => `.header nav a[href^="${path}"]`;

/** One guided tour per page of the teacher website. The first visit of each page opens its tour once. */
export const SITE_TOURS: Record<string, TourStep[]> = {
  home: [
    {
      title: 'Bem-vindo ao TedTronics!',
      text: 'Este é o site do professor: aqui você cria lições, organiza módulos e turmas e acompanha o progresso dos alunos na bancada. Vamos fazer um tour rápido.',
    },
    {
      target: '.header nav',
      title: 'Menu principal',
      text: 'Cada aba é uma parte do trabalho. Vamos ver uma por uma.',
    },
    {
      target: nav('/home'),
      title: 'Lições',
      text: 'Suas lições e as do currículo TedTronics. Cada lição é guiada (passo a passo) ou um desafio.',
    },
    {
      target: nav('/modulos'),
      title: 'Módulos',
      text: 'Um módulo é uma trilha de lições em ordem. É o módulo que vai para a bancada.',
    },
    {
      target: nav('/turmas'),
      title: 'Turmas',
      text: 'Crie turmas, cadastre alunos e escolha quais módulos cada turma estuda.',
    },
    {
      target: nav('/alunos'),
      title: 'Alunos',
      text: 'Todos os alunos, cada um com o seu ID único. Quem usa cada bancada é escolhido no app do professor.',
    },
    { target: nav('/painel'), title: 'Painel', text: 'Progresso, pontuação e tempo de cada aluno, por turma.' },
    {
      target: nav('/editor'),
      title: 'Editor',
      text: 'Monte o circuito na protoboard (ou no esquema) e escreva os passos e as perguntas.',
    },
    {
      target: nav('/sandbox'),
      title: 'Sandbox',
      text: 'Teste circuitos livremente ou veja uma lição exatamente como na tela da bancada.',
    },
    {
      target: '.lesson-library-buttons',
      title: 'Criar ou importar',
      text: '“Nova lição” abre um formulário rápido. O + importa uma lição salva em arquivo .json.',
    },
    {
      target: '.lesson-tag-filter',
      title: 'Filtros',
      text: 'Filtre as lições por etiqueta: currículo, guiada, desafio…',
    },
    {
      target: '.lesson-card',
      title: 'Cada lição',
      text: 'O desenho mostra o circuito da lição. “Editar” abre o editor; “Testar” mostra como o aluno vai ver. Passe o mouse nos ícones para duplicar, exportar ou excluir.',
    },
    {
      target: '.help-btn',
      title: 'Ajuda sempre à mão',
      text: 'Toque no ? em qualquer página para ver o tutorial dela de novo.',
    },
  ],
  modulos: [
    { target: '.page-head .icon-btn', title: 'Novo módulo', text: 'O + cria um módulo: dê um título e uma descrição.' },
    {
      target: '.workspace-page > section.panel.workspace-form',
      title: 'Currículo pronto',
      text: 'O currículo TedTronics já vem em módulos. Este quadro adiciona ou atualiza as trilhas na sua conta.',
    },
    {
      target: '.workspace-card-actions',
      title: 'Abrir módulo',
      text: 'Dentro do módulo você ordena as lições e escolhe as turmas. A bancada apresenta as lições nesta ordem.',
    },
  ],
  turmas: [
    { target: '.page-head .icon-btn', title: 'Nova turma', text: 'O + cria uma turma.' },
    {
      target: '.workspace-card-actions',
      title: 'Abrir turma',
      text: 'Na turma você cadastra os alunos e escolhe os módulos que ela estuda. “Desempenho” abre o painel da turma.',
    },
  ],
  turma: [
    {
      target: '.item-head',
      title: 'Dados da turma',
      text: 'Nome, descrição e números. O lápis edita; a lixeira exclui a turma.',
    },
    {
      target: '.section-head',
      title: 'Alunos',
      text: 'O + cadastra um aluno. Em cada aluno: ID, desempenho, editar e excluir.',
    },
    {
      target: '.class-study',
      title: 'O que a turma estuda',
      text: 'Adicione módulos (e lições avulsas). É isso que conta no progresso da turma.',
    },
  ],
  alunos: [
    { target: '.section-head .select-pill', title: 'Filtrar por turma', text: 'Mostra só os alunos de uma turma.' },
    {
      target: '.section-head .icon-btn',
      title: 'Novo aluno',
      text: 'O + cadastra um aluno, com apelido (aparece na bancada). O ID único é gerado sozinho.',
    },
    {
      target: '.student-actions',
      title: 'Ações do aluno',
      text: 'ID único do aluno, desempenho, editar e excluir. Mudar o aluno de turma não apaga o progresso.',
    },
  ],
  painel: [
    {
      title: 'Painel',
      text: 'Escolha uma turma para ver progresso, pontuação e tempo de cada aluno. Os dados chegam quando o app do professor sincroniza a bancada.',
    },
    { target: '.workspace-actions select', title: 'Turma', text: 'Troque a turma aqui.' },
    { target: '.stat-row', title: 'Resumo', text: 'Números da turma inteira. Abaixo, cada aluno.' },
  ],
  editor: [
    {
      title: 'Editor de lições',
      text: 'À esquerda as peças, no meio a protoboard, à direita a lição. Cada caixa tem abas e rola sozinha.',
    },
    {
      target: '.board-tray-column',
      title: 'Bandeja',
      text: 'Arraste peças para a protoboard. Clique numa peça para girar; arraste para fora para remover.',
    },
    {
      target: '.board-header .box-tabs',
      title: 'Protoboard ou Esquema',
      text: 'No Esquema você liga os símbolos num desenho e a montagem na protoboard é feita sozinha.',
    },
    { target: '.board-clear', title: 'Limpar', text: 'A borracha tira todas as peças da protoboard.' },
    {
      target: '.lesson-panel .box-tabs',
      title: 'A lição',
      text: 'Lição: título, instrução e opções. Passos: o roteiro guiado. Perguntas: antes ou depois da montagem.',
    },
    {
      target: '.lesson-panel-footer',
      title: 'Salvar e testar',
      text: 'Salve a lição, exporte em .json ou teste do jeito que o aluno vê.',
    },
  ],
  sandbox: [
    {
      target: '.sandbox-mode-toggle',
      title: 'Dois modos',
      text: 'Sandbox livre para testar qualquer circuito; Validador para ver uma lição como na bancada.',
    },
    { target: '.board-slot', title: 'Protoboard', text: 'Monte aqui. As abas em cima trocam para o Esquema.' },
    { target: '.lab-right .board-tray-column', title: 'Peças', text: 'Arraste as peças da bandeja para a protoboard.' },
    {
      target: '.lab-box',
      title: 'Energizar e validar',
      text: 'Energize para ver a corrente e use “Validar circuito” para conferir a montagem.',
    },
  ],
  validador: [
    {
      target: '.bench-preview-frame',
      title: 'Prévia da bancada',
      text: 'Esta é a tela de 7" da bancada, exatamente como o aluno vê, uma tela por vez.',
    },
    {
      target: '.bench-carousel',
      title: 'Navegar pelas telas',
      text: 'Pule para qualquer tela da lição pelas bolinhas ou pelas setas.',
    },
    { target: '.bench-preview-bar', title: 'Controles', text: 'Volte ao editor ou ligue a depuração da validação.' },
  ],
};

/** Which tour belongs to a site path. */
export function siteTourKey(pathname: string): string | null {
  if (pathname === '/' || pathname.startsWith('/home')) return 'home';
  if (pathname.startsWith('/modulos')) return 'modulos';
  if (/^\/turmas\/\d+/.test(pathname)) return 'turma';
  if (pathname.startsWith('/turmas')) return 'turmas';
  if (pathname.startsWith('/alunos')) return 'alunos';
  if (pathname.startsWith('/painel')) return 'painel';
  if (pathname.startsWith('/editor')) return 'editor';
  if (pathname.startsWith('/sandbox/licao')) return 'validador';
  if (pathname.startsWith('/sandbox')) return 'sandbox';
  return null;
}
