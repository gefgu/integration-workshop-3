# Alterações da branch `branch-nova`

Este documento descreve tudo o que mudou na branch `branch-nova` em relação à `main` (commit `fd3f1a2`).
As mudanças estão em quatro commits (os três primeiros já existentes e o último que acompanha este arquivo).

Onde não há nota em contrário, a verificação foi por testes automáticos e por uso no navegador. A bancada física,
o Bluetooth e o app do celular **não** foram testados (ver [O que não foi verificado](#o-que-não-foi-verificado)).

---

## 1. Fluxo do professor (site e app)

Objetivo: deixar claro o caminho "conta vazia → módulo na bancada do aluno".

| Mudança | Onde |
|---|---|
| Página **Início / Primeiros passos** com checklist e barra de progresso: conteúdo, turma, alunos com tag, atribuir módulo, enviar para a bancada. O próximo passo fica destacado; turma e atribuição de módulo podem ser feitas ali mesmo. O login passa a levar para `/inicio`. | `teacher_authoring_app/src/guide/` |
| **Importar o currículo pronto** (20 lições, 5 módulos) por um botão, sem rodar script. Mesmas regras do script `seed-curriculum`: só mexe em `curriculo-*`, não apaga nada. | `src/api/curriculum.ts` |
| **Estados vazios que orientam** em Turmas, Alunos e Módulos. | `src/workspace/*.tsx` |
| Tela de Módulos do **app do celular** com passos numerados (bancada, módulo, turma) e botão que diz o que falta ("Enviar para a bancada (escolha a turma)"). | `teacher_mobile_app/src/app/modulos.tsx` |

## 2. Bancada (tela do aluno)

- Mensagens de "bancada bloqueada" e "sem módulo" explicam o que o professor precisa fazer.
- **Modo demonstração** carrega um módulo de exemplo (Trilha 1) e um aluno com a tag `TAG-1`. Também há o botão
  "Carregar módulo de exemplo" quando a bancada está liberada e sem módulo.
- O módulo de demonstração tem `version_id` derivado do conteúdo (`demo-<hash>`). Quando o currículo muda, a bancada
  **troca sozinha** o módulo de demonstração antigo. Um módulo real enviado pelo professor nunca é substituído.
- Serviço da bancada: `POST /dev/unlock` aceita um `package` opcional (`bench/service/bench_service/server.py`).

## 3. Lições do currículo

### Lição 1
- O **desafio** foi refeito: encaixar a bateria e responder 3 perguntas novas sobre nós (os dois sockets, colunas
  vizinhas, os dois lados da bateria). Antes ele repetia a pergunta da lição guiada e a instrução pedia coisas que
  não existiam.

### Lição 2
- O circuito passou a precisar de **um só jumper** (o LED divide a coluna do − com a bateria). Antes o passo exigia
  dois jumpers, mas a checagem final aceitava um.
- O desafio começa sem o jumper (não há mais sorteio entre dois).
- Textos, missão do experimento e pergunta final foram ajustados ("tire o jumper").

### Passos de montagem **em grupo** (lições 2 a 8 e 10)
Em vez de "coloque a bateria", "coloque o LED"…, cada passo coloca as peças e já exige a conexão entre elas
(por exemplo: "Coloque a bateria e o LED na bancada e conecte os dois"). Se estiverem na bancada mas não
conectadas, o mascote diz que não estão conectadas e quais ligações faltam.

- Modelo: `LessonStep.pieceIds?: string[]` (`pieceId` continua sendo a primeira peça). A ação do grupo é
  `place_connection`. O editor, o esquema (`docs/lesson.schema.json`) e `cumulativeBoard`/`toValidatorLesson`
  entendem o grupo.
- Validador: o lint aceita vários `add` quando a ação é `place_connection`. Um passo `place_component` continua
  com uma peça só (SFR4). Teste novo em `graph_validator/tests/test_steps.py`.
- Cada grupo termina com uma frase do conceito aprendido (ex.: "O resistor e o LED estão em série…").
- A lição 1 ficou como estava (só tem a bateria).

### Valor do resistor
- Todo passo de montagem e todo desafio do currículo **confere o valor do resistor** (`matchValues`). Corrigido um
  texto da lição 8 que não dizia qual resistor usar.

### Linguagem
- "banco" virou **"socket"** em tudo que o mascote fala e nas telas de explicação ("banco de dados" e "bancada"
  ficaram como estavam).
- Jumpers renomeados na bandeja, nos textos e na voz: **Jumper super longo** (antes "3 colunas") e
  **Jumper super hiper longo** (antes "4 colunas"). Os tipos internos (`jumper_3`, `jumper_4`) não mudaram.

## 4. Dicas do mascote

1. **Passos de montagem das lições guiadas**: cada passo tem respostas próprias, geradas a partir do circuito
   (`src/curriculum/stepHints.ts`): qual peça falta, qual valor usar, quais duas coisas um jumper liga, LED/bateria
   ao contrário, circuito aberto (com o percurso da corrente da lição), curto. Vão nos `overrides` do passo e, por
   isso, ganham voz do tutor quando a lição é salva.
2. **Desafios**: escada de dicas em quatro níveis (`src/player/hints.ts`): pista que não entrega a resposta, texto
   do validador, pista mais próxima, quase a resposta. Desafios 2, 4, 5 e 9 têm dicas próprias; os demais mostram
   "Faltam na bancada: …" / "Estão sobrando: …". Corrigida a dica antiga que falava em "dois jumpers".
3. **Simulação**: as 10 mensagens do simulador (`src/engine/sim.ts`, `MSG`) dizem o que verificar.
4. **"Montagem certa! Tente energizar!"**: aparece quando o circuito final está certo e o aluno ainda não energizou.
   A frase está no pacote de voz (`graph_validator/.../tts/phrases.py`), junto com as falas novas de dica.

## 5. Apoios visuais no passo

- **Barra "🎯 Objetivo desta etapa"** fixa no topo (`src/player/GoalBar.tsx`): mostra o texto do passo, que o mascote
  não sobrescreve com dicas. Nos experimentos lista as missões com ✅/⬜; nos passos em grupo lista "peça X na
  bancada" e "Tudo conectado como pedido", marcados ao vivo.
- Correção de bug: na lição 2 o aviso de limite de corrente escondia a missão que faltava e o botão **Continuar**
  parecia sumido. A mensagem agora diz "Ainda falta: …".
- **Pontilhado verde** (`src/engine/linkHint.ts`, `src/components/LinkHintOverlay.tsx`): depois de uma tentativa com
  erro de ligação, desenha uma linha pontilhada do pino do componente que está no subcircuito maior até a coluna onde
  ele deve ser conectado. Funciona por redes elétricas (independe de onde o aluno montou); nos desafios só aparece
  junto com a dica falada; não aparece para erros de peça (faltando, sobrando, valor, polaridade).

## 6. Validador e dados

- `graph_validator/src/graph_validator/steps.py`: regra de lint dos passos em grupo (ver acima).
- `graph_validator/.../tts/phrases.py`: frases novas no pacote de voz e nomes novos dos jumpers.
- **Reiniciar a API** (`npm run validator`) depois de atualizar: o processo antigo ainda tem a regra de lint antiga.
- Depois de atualizar o currículo, importe de novo (botão em Início ou `npm run seed:curriculum`).

## 7. Testes

- Site: `cd teacher_authoring_app && npm test && npx tsc --noEmit` (109 testes).
  Novos: `setup-steps`, `step-hints`, `link-hint`; ajustados `curriculum` e `steps`.
- Validador: `cd graph_validator && .venv/bin/python -m pytest` (91).
- Bancada: `cd bench/service && ../../graph_validator/.venv/bin/python -m pytest` (7).

## 8. Atenção ao atualizar

- O **número de etapas** de várias lições mudou. O progresso já salvo na bancada pode retomar em uma etapa fora do
  lugar. Para zerar a demonstração, apague `bench/service/bench.sqlite3` (arquivo local, ignorado pelo git).
- Lições salvas antes guardam o texto antigo dos passos; reimporte o currículo.
- Lições criadas pelo professor no editor **não** recebem as dicas específicas nem os passos em grupo
  automaticamente (continuam com as mensagens genéricas do validador). O editor, porém, abre e salva lições que
  têm passos em grupo.

## O que não foi verificado

- Bancada física, câmera, Bluetooth e o **app do celular** (o `node_modules` dele não está instalado, então nem o
  typecheck rodou). A tela de Módulos do app foi alterada só por leitura de código.
- A **voz do tutor**: a importação das lições foi instantânea neste computador, o que sugere que o Piper não está
  instalado; as falas novas não foram ouvidas.
- Arrastar peças com o mouse na ferramenta de teste não funcionou; os passos de montagem foram verificados com o
  botão "preencher com o gabarito", com o validador e por testes unitários.
- A conclusão da missão "tire o jumper" (lição 2) é coberta por teste automático, não por uso na tela.
- O pontilhado verde foi visto na tela só na lição 4.
- O fluxo completo professor → app → bancada → sincronização não foi refeito de ponta a ponta nesta branch.

## Ideias que ficaram de fora

- Dicas específicas e passos em grupo para lições criadas no editor.
- O "Jumper 5 colunas" mantém o nome antigo.
- Os desafios mostram o objetivo duas vezes (linha de instrução e barra); dá para remover a linha repetida.
