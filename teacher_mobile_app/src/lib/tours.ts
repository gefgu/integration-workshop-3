import type { TourStep } from '../components/Tour';

/** The phone app's guided tours, one per screen (first visit + the ? button). */
export const APP_TOURS: Record<string, TourStep[]> = {
  home: [
    {
      title: 'Bem-vindo ao app do professor!',
      text: 'Com ele você leva as aulas para a bancada, libera os alunos e traz o progresso deles. Vamos ver como funciona.',
    },
    {
      target: 'home-cta',
      title: 'Levar aula à bancada',
      text: 'O caminho principal: conecte a bancada, escolha a turma e o módulo e envie. Os alunos já podem entrar com a tag.',
    },
    {
      target: 'home-bench',
      title: 'Bancada',
      text: 'Mostra se o celular está conectado e qual módulo está carregado. A bancada só libera as lições com o app conectado.',
    },
    {
      target: 'home-sync',
      title: 'Progresso dos alunos',
      text: 'A bancada guarda o progresso. Este botão busca da bancada e envia ao servidor; sem internet, fica guardado no celular e vai depois.',
    },
    {
      title: 'Abas lá embaixo',
      text: 'Turmas: alunos, tags e progresso. Módulos: escolha um e leve à bancada. Bancada: conectar por Bluetooth ou simulador.',
    },
    { target: 'home-help', title: 'Ajuda', text: 'Toque no ? em qualquer tela para ver o tutorial dela de novo.' },
  ],
  turmas: [
    { target: 'turmas-first', title: 'Suas turmas', text: 'Toque numa turma para ver os alunos, as tags e o progresso de cada um.' },
  ],
  turma: [
    { target: 'turma-summary', title: 'Resumo da turma', text: 'Quantos alunos, progresso médio e pontuação média nos desafios.' },
    {
      target: 'turma-send',
      title: 'Levar aula',
      text: 'Abre o passo a passo para enviar um módulo desta turma para a bancada.',
    },
    {
      target: 'turma-student',
      title: 'Cada aluno',
      text: 'Tag vinculada, lições concluídas e melhor pontuação. Toque no aluno para ver tempo na bancada e última atividade.',
    },
  ],
  modulos: [
    {
      target: 'modulos-first',
      title: 'Módulos',
      text: 'Toque num módulo para ver a descrição e o botão “Levar à bancada”. Módulos são criados no site.',
    },
  ],
  bancada: [
    {
      target: 'bench-modes',
      title: 'Como conectar',
      text: 'Bluetooth: a bancada de verdade, perto do celular. Simulador: uma bancada no computador, pela mesma rede Wi-Fi.',
    },
    {
      target: 'bench-connect',
      title: 'Conectar',
      text: 'Procure a bancada (Bluetooth) ou digite o IP do computador (simulador). Conectada, a bancada é liberada para os alunos.',
    },
    {
      target: 'bench-connected',
      title: 'Bancada conectada',
      text: 'Aqui você vê o módulo carregado e os registros guardados, busca o progresso ou desconecta.',
    },
  ],
  enviar: [
    {
      target: 'enviar-stepper',
      title: 'Quatro passos',
      text: 'Bancada → Turma → Módulo → Enviar. O passo atual fica em destaque; os concluídos ficam verdes.',
    },
  ],
};
