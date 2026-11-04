/** The teacher's path from an empty account to a module on the bench, derived from what already exists. Pure, for tests. */
export interface SetupData {
  classes: { id: number }[];
  students: { nfc_code: string | null }[];
  modules: { class_ids: number[] }[];
}

export interface SetupStep {
  id: 'content' | 'class' | 'students' | 'assign' | 'send';
  title: string;
  help: string;
  doneText: string;
  done: boolean;
}

export function setupSteps({ classes, students, modules }: SetupData): SetupStep[] {
  const tagged = students.filter((student) => student.nfc_code).length;
  const assigned = modules.filter((module) => module.class_ids.length > 0).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    {
      id: 'content',
      title: 'Escolher o conteúdo',
      help: 'O currículo TedTronics já traz 20 lições e 5 módulos prontos, na ordem de ensino. Importe e pronto, sem criar nada do zero.',
      doneText: `${plural(modules.length, 'módulo disponível', 'módulos disponíveis')}.`,
      done: modules.length > 0,
    },
    {
      id: 'class',
      title: 'Criar a turma',
      help: 'A turma reúne os alunos que vão receber o módulo.',
      doneText: plural(classes.length, 'turma criada', 'turmas criadas') + '.',
      done: classes.length > 0,
    },
    {
      id: 'students',
      title: 'Cadastrar alunos e vincular tags',
      help: 'Cada aluno entra na bancada aproximando uma tag NFC (ou digitando o código, ex.: TAG-1).',
      doneText: `${plural(students.length, 'aluno', 'alunos')}, ${tagged} com tag.`,
      done: tagged > 0,
    },
    {
      id: 'assign',
      title: 'Atribuir o módulo à turma',
      help: 'Escolha qual módulo cada turma vai estudar. Ele define o que conta no progresso.',
      doneText: `${plural(assigned, 'módulo atribuído', 'módulos atribuídos')}.`,
      done: assigned > 0,
    },
    {
      id: 'send',
      title: 'Enviar para a bancada',
      help: 'Este passo é feito no app do professor, no celular.',
      doneText: '',
      done: false,
    },
  ];
}
