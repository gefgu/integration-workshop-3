# Formato da lição (versão 3)

Uma lição é um documento JSON. O editor cria o documento, o servidor guarda (`saved_lessons.document`) e a bancada recebe dentro do pacote do módulo.
O validador de grafo nunca lê esse documento diretamente. Ele recebe o resultado de `toValidatorLesson()` (`src/model/steps.ts`).
Por isso dá para criar, mudar ou estender passos sem alterar o motor de validação (SNFR12).

O esquema formal está em [`lesson.schema.json`](lesson.schema.json). Na leitura, o código usa `validateLesson()` (`src/model/lesson.ts`). No servidor, `LessonInput` (`graph_validator/src/graph_validator/service/workspace.py`) confere o tipo da lição e o formato dos passos e quizzes.

## Campos

| Campo | Tipo | Significado |
|---|---|---|
| `version` | `3` | Versão do formato. As versões 1 e 2 são migradas na leitura. |
| `id` | texto | Identificador estável. Os módulos, as turmas e os eventos de progresso usam esse id. |
| `title`, `instruction` | texto | Aparecem na bancada e no tutor. |
| `kind` | `guided` \| `challenge` | `guided` tem um grafo-alvo por passo (SFR2). `challenge` valida só o circuito final (SFR3). |
| `board.pieces[]` | `Piece` | O circuito final, na grade 11 × (6+6). |
| `steps[]` | `LessonStep` | Os passos da lição guiada, em ordem. |
| `timeLimitS` | número ou `null` | Tempo máximo do desafio (SFR24). |
| `quizzes[]` | `Quiz` | Perguntas mostradas antes (`before`), depois (`after`) ou dentro de um passo (`step`). |
| `updatedAt`, `audio` | | O servidor preenche ao salvar. |
| `lessonVersion` | texto | Existe só no pacote da bancada: um hash do documento (SFR58). |

### Piece

```json
{"id": "r1", "type": "resistor_cc", "a": 3, "b": 4, "row": 1, "value": 470}
```

- `a` e `b` são as colunas dos terminais (1–11). `row` vai de 0 a 11: as linhas 0–5 são o banco A e as linhas 6–11 são o banco B.
- `value` existe só para dois tipos:
  - `potenciometro`: um dos valores de `POT_VALUES`.
  - `resistor_cc`: um valor que os três discos conseguem formar (`CC_VALUES`, EFR12).
- `c` e `config` existem só nas cápsulas inteligentes (`capsula_*`).

### LessonStep

| Campo | Significado |
|---|---|
| `action` | Uma única ação por passo (SFR4). Valores possíveis: `place_component`, `place_connection`, `connect_circuit` ou `interact`. |
| `pieceId` | A peça que o passo acrescenta. O grafo-alvo do passo é a soma das peças dos passos anteriores com esta. |
| `quizId` | Usado em passos `interact`. A resposta do aluno aprova o passo (SFR19). |
| `text` | A fala do tutor, no máximo 2 linhas (SNFR5). |
| `options.matchValues` | Exige o mesmo valor de resistor ou potenciômetro. |
| `options.strictPositions` | Exige o mesmo formato na grade, mesmo que o circuito esteja deslocado (SFR8). |
| `overrides` | Mensagem própria por categoria e por peça: `{categoria: {família \| "*": texto}}` (SFR15.1). |

O limite entre um passo e o próximo é o grafo-alvo do próprio passo (SFR23). O professor define esses limites no editor de passos.
