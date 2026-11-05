import type { TourStep } from '../components/Tour.tsx';

/** Guided tours of the bench screen. Students move through them with the joystick (→ / OK) and skip with Voltar. */
export const BENCH_TOURS: Record<string, TourStep[]> = {
  'bench-home': [
    {
      title: 'Olá! Esta é a bancada TedTronics',
      text: 'Você monta circuitos de verdade na protoboard, e a tela te guia passo a passo. Use o joystick para andar (setas) e aperte para confirmar.',
    },
    {
      target: '.bench-hero-nfc',
      title: 'Sua tag',
      text: 'Aproxime a sua tag do leitor para entrar. A bancada lembra onde você parou.',
    },
    {
      target: '.bench-foot',
      title: 'Ranking e câmera',
      text: 'Veja os melhores dos desafios e o que a câmera está enxergando na protoboard.',
    },
    { target: '.bench-help', title: 'Ajuda', text: 'Escolha o ? com o joystick para ver este tutorial de novo.' },
  ],
  'bench-student': [
    {
      target: '.bench-continue',
      title: 'Continuar',
      text: 'Começa a próxima lição ou volta exatamente de onde você parou.',
    },
    { target: '.bench-lessons', title: 'Suas lições', text: 'Todas as lições do módulo. As concluídas ficam verdes.' },
    { target: '.bench-pager', title: 'Mais lições', text: 'Use as setas para ver as outras páginas.' },
    {
      target: '.bench-foot',
      title: 'Ranking, câmera e sair',
      text: 'Quando terminar, escolha Sair para a próxima pessoa usar a bancada.',
    },
  ],
  'bench-lesson': [
    {
      title: 'Como funciona uma lição',
      text: 'Você monta na protoboard de verdade. A câmera vê as peças e a tela mostra a mesma montagem.',
    },
    {
      target: '.lab-step > :first-child',
      title: 'O tutor',
      text: 'O hamster diz o que fazer em cada passo e avisa se algo está errado.',
    },
    {
      target: '.lab-step .board-tray-column',
      title: 'Pegue na bandeja',
      text: 'Mostra a peça deste passo. As outras ficam apagadas: pegue só a que está em destaque.',
    },
    {
      target: '.lab-step .board-workbench-column',
      title: 'Sua montagem',
      text: 'É a protoboard da bancada vista pela câmera. Encaixe a peça de verdade e ela aparece aqui.',
    },
    {
      target: '.bench-camera-chip',
      title: 'Câmera',
      text: 'Mostra se a câmera está lendo a placa. Tire a mão da frente para ela enxergar.',
    },
    {
      target: ['.power-indicator', '.power-row'],
      title: 'Energizar',
      text: 'Aperte o botão ENERGIZAR da bancada para ligar o circuito e ver se funciona. Aperte de novo para desligar.',
    },
    { target: '.bench-bar-steps', title: 'Seu progresso', text: 'Cada bolinha é uma etapa da lição.' },
    {
      target: '.bench-bar-back',
      title: 'Voltar',
      text: 'O botão Voltar da bancada sai da lição. Seu progresso fica salvo.',
    },
  ],
};
