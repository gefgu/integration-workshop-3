# Round 2: teacher critic review

Reviewer: teacher critic (Claude Opus 5.5, `claude-opus-5-5`), 2026-10-31.
Scope: `AI/teacher-critic.md` + round-2 additions in `AI/_common-environment.md`. Driven in headless Chrome via
`graph_validator/tools/cdp.py`; API at :8010, bench service at :8766. Scripts and screenshots are in my scratchpad
(`/tmp/claude-1000/-home-gustavo-Documents-UTFPR-oficinas-integration-workshop-3/710a118f-9d89-45f9-9efc-d49f703e7864/scratchpad`).

Status: complete.

Data note: the isolated DB was reset since round 1. My round-1 test lessons and module 6 are gone; the list shows
20 curriculum lessons and 5 modules. Test data I create in round 2 is titled "Revisor R2 — …".

## Part 1: re-check of round-1 MAJOR findings

### T-01 (stale jumper step text after swapping the jumper): FIXED
- Action: Nova lição → battery A1, Resistor 470 Ω A3, LED A5, Jumper longo A1 (row 4), Jumper curto A4, Jumper 5 colunas A2
  → Gerar passos → Salvar → drag "Jumper 5 colunas" out → drag "Jumper 4 colunas" to A2 → Salvar → Testar.
- Evidence: after the swap the editor showed "Colocar jumper · Jumper 4 colunas"; the API step for `p6` (now `jumper_4`)
  reads "Coloque o jumper de 4 colunas na bancada. As conexões serão conferidas no passo final."; the player at
  "Etapa 5 de 7" shows the same text. (Lesson `lesson-510c6177`, script `s10_jumpers2.py`.)

### T-02 (jumper "colunas" words contradict tray names): FIXED
- Same action. Generated texts: "Coloque o jumper longo na bancada…", "Coloque o jumper curto na bancada…",
  "Coloque o jumper de 5 colunas…" / "…de 4 colunas…": these now match the tray labels ("Jumper longo", "Jumper curto",
  "Jumper 4 colunas"). No "1 colunas" any more.

### T-07 (no suggested order in Lições): FIXED
- Evidence: the Lições list now runs Lição 1 (guiada), Lição 1 (desafio), Lição 2 (guiada) … Lição 10 (guiada), and a
  hint reads "Começando agora? As lições do currículo ficam depois das suas, na ordem de ensino: comece pela “Lição 1” e
  use a versão guiada antes do desafio. Em Módulos há trilhas já montadas." (screenshot `shots/s01_home.png`).

### T-08 (teacher notes full of developer jargon): FIXED (small leftovers, see T2-xx below)
- Action: read the "Notas do professor" of all 20 lessons (API `GET /workspace/lessons`, field `teacherNotes`, which is
  what the card shows).
- Evidence: no "Notion", "git", file names or setting names (`ccLimited`, `hintAfter`, `allowNoResistor`, `matchValues`)
  remain. Every note now has "Objetivo:", "Como saber que deu certo:" and "Simulação: as correntes, o brilho, o som e o
  LED de status são calculados pelo software; nada é medido na bancada física nem lido pela câmera."

### T-09 (no way to send to a bench; unnamed "app do professor … por Bluetooth"): PARTIAL
- Action: Módulos → "Abrir módulo" (Currículo completo) → section "Pacote para a bancada".
- Evidence: the text is now "Este site não se conecta à bancada: ele monta o pacote do módulo para a turma escolhida. O
  envio à bancada é feito pelo aplicativo do professor, no celular, por Bluetooth. Aqui você pode baixar o mesmo pacote
  (JSON) para conferência." The Módulos header says "o aplicativo do professor leva o pacote à bancada." This is clearer
  (it says plainly the site does not talk to the bench), but there is still no name, link or install hint for the phone
  app, and the sentence states Bluetooth delivery as a working fact. A `teacher_mobile_app` with `src/lib/bleTransport.ts`
  exists in the repo, but I could not verify that the BLE path works with a bench, and the bench screen I tested
  (`bench.html?servico=…`) receives its module from the bench service, not via a phone.

### T-03 (save error names a question number that is not on screen): FIXED
- Action: Nova lição → title + instruction → "+ Explicação" → "+ Pergunta" (in Passos) → "+ Pergunta" (bottom section) →
  fill only the step question's prompt and two alternatives → Salvar.
- Evidence: the blocks are now numbered globally, "Pergunta 1" (under "Perguntas dos passos …") and "Pergunta 2" (under
  "Perguntas"); the textareas have `aria-label` "Enunciado da pergunta 1" / "…2" (so T-21 is fixed too). Save refused
  with a list: "Pergunta 2: escreva o enunciado.", "Pergunta 2: há alternativa em branco.", "Passo 1: escreva a
  explicação ou adicione uma ilustração." Nothing was stored (lesson id absent from the API afterwards).

### T-04 (unsaved changes lost silently; "Testar" hides that nothing was saved): PARTIAL
- Fixed parts: a banner "Alterações ainda não salvas: se sair desta página, elas se perdem." appears as soon as a field
  changes (and is absent right after opening a saved lesson). "Testar" on an unsaved lesson now shows "Você está testando a
  versão aberta no editor, que ainda não foi salva. Volte ao editor e clique em Salvar para guardá-la." "Voltar ao editor"
  keeps the unsaved title and question text. A `beforeunload` handler is registered (a synthetic event was
  `defaultPrevented`), so a reload/close tab should ask (the real browser prompt can't be shown headless).
- Still broken: see **T2-01** (in-app navigation leaves without asking).

### T-05 (question editor hidden in a collapsed section): PARTIAL
- Evidence: the section is now open by default (`<details open>`) and labelled "Perguntas dos passos (o enunciado e as
  alternativas de cada “Pergunta” acima ficam aqui)"; the step card shows "Pergunta deste passo" with a selector that is
  auto-linked to the new question and shows its prompt once typed. The prompt and alternatives are still edited far below
  the step (step card vs. editor were ~1000 px apart in a short lesson). Acceptable now; inline editing would still be
  better. Downgraded to Minor.

### T-06 (duplicate masquerades as an official example): FIXED
- Action: Lições → "Lição 3 — … (desafio)" → "Duplicar".
- Evidence: the copy "Lição 3 — Limitando a corrente: o resistor (desafio) (cópia)" has tags `desafio, previsão,
  comparação, experimento` (no `currículo`/`exemplo`); chips "currículo (20)", "exemplo (20)", "Todas (22)". The copy is
  listed first (own lessons before the curriculum). The original's JSON was unchanged (md5 before/after). The quiz ids of
  the copy are new (`quiz-89944710`, `quiz-deec5f67`), so T-18 is fixed. Opening a curriculum lesson's editor now says
  "Esta é uma lição de exemplo do currículo. Para adaptar sem alterá-la, volte a Lições e use “Duplicar”."
- Leftover (Minor, T2-02): Duplicar stays on the list (URL `/home`), and the copy's editor has no "Cópia de …; o original
  não muda" note (only the "(cópia)" title suffix).

Minor round-1 items seen in passing: T-10 NOT FIXED ("Todas (20)", "currículo (20)", "exemplo (20)" still identical
before I added my own lessons; 32 chips). T-14 NOT FIXED ("Lição salva no banco de dados. Sem voz do tutor (TTS
desligado.)."). T-16 PARTIAL (see T2-04). T-18 FIXED. T-20 FIXED ("1 peça", "1 pergunta"). T-21 FIXED.

## Part 2: areas not reached in round 1

### Modules (create, add, reorder, assign, package)
Action: Módulos → Novo módulo "Revisor R2 — minha trilha" → Criar módulo (→ `/modulos/6`) → picker: added "Revisor R2 —
jumpers", "Lição 2 — … (guiada)", the L3 copy → ↓ on the first → checkbox "E2E currículo" → Salvar módulo → reload →
"Selecione a turma" = E2E currículo → "Baixar pacote" (scripts `s17_module_build.py`, `s18_reorder.py`,
`s19_modsave.py`).
Works: lessons were added in order; ↑/↓ moved them (first ↑ and last ↓ disabled); the class checkbox persisted; after
reload the list and class were intact (API `lesson_ids` and `class_ids: [1]`). "Baixar pacote" downloaded
`pacote-modulo-6-turma-1.json` (26 KB) with module, class, the 3 full lessons and the student list (name, nickname,
`nfc_code`). The class page (`/turmas/1`) lists the module, and Painel switched to "20/22 lições" for the student, so the
new module counts in progress immediately.

#### T2-03 (Minor): the module page mixes instant saving with a "Salvar módulo" button that gives no feedback
- Where: Módulos → module page.
- Action/evidence: pressing ↓ changed the API order immediately (`['curriculo-02-guiada','lesson-510c6177',…]` before
  any Salvar); unticking "E2E currículo" changed `class_ids` to `[]` immediately. But a title edit is only stored by
  "Salvar módulo": I changed the title, clicked "← Todos os módulos", and the API title was unchanged, with no warning and
  no unsaved banner (unlike the lesson editor). "Salvar módulo" itself shows no "salvo" message (page text identical before
  and after; API confirmed the save).
- Fix: either save title/description on blur too, or show the same "Alterações ainda não salvas" banner and a "Módulo
  salvo." confirmation; say near the list that order and classes save automatically.

#### T2-04 (Minor, was T-16): lesson pickers list lessons in reverse order; copies still get a doubled type
- Where: module page "Selecione uma lição"; class page "Lições avulsas".
- Evidence: options run "Lição 10 … (guiada)", "Lição 9 … (desafio)", "Lição 9 … (guiada)" … "Lição 1 … (guiada)" (own
  lessons first). The copy reads "Lição 3 — Limitando a corrente: o resistor (desafio) (cópia) (desafio)" and the pot
  variant "Lição 8 — Gerando som: o buzzer (versão com potenciômetro) (guiada)". The "(guiada) (guiada)" doubling of
  round 1 is gone.
- Fix: use the same order as the Lições page (Lição 1 → 10); only append the type when the title does not already state
  it.

#### T2-05 (Note): a module built on the website does not reach the bench screen I could test
- The bench screen shows "bancada-e358b7 · Currículo completo — Fundamental II" and only that module; module 6 never
  appears there. That matches the page text ("Este site não se conecta à bancada"), so it is consistent, but a teacher
  with no phone app has no path from Módulos to the bench except the JSON file, and the page does not say what to do
  with that JSON.

### Bench screen with tag E2E-TAG-1 (`bench.html?servico=http://127.0.0.1:8766`)
- Start: mascot "Módulo “Currículo completo — Fundamental II”. Aproxime sua tag do leitor para começar!", field
  "Aproxime a tag (ou digite o código)", buttons Entrar / Ranking / Câmera.
- Unknown tag "TAG-INEXISTENTE": "Tag não reconhecida — chame seu professor."
- E2E-TAG-1: "Oi, e2e! Você concluiu todas as lições deste módulo. Que tal refazer um desafio?" and all 20 lessons as
  "Guiada · Concluída" / "Desafio · Concluída".
- Clicking "Lição 2 — O primeiro circuito fechado (guiada)" started it at "Etapa 1 de 9" with the explanation, then
  "Coloque a bateria na bancada." with the tray (`shots/s06_play0.png`). Works.
- Ranking: a lesson selector (only the 9 challenges) and "🥇 e2e 90 pts · 30 s".
- Câmera: headless Chrome has no camera, the screen said "A bancada não tem permissão para usar a câmera. Chame seu
  professor." with a black preview. Honest; nothing claims recognition.

### Turmas, Alunos, Painel
- Turmas → "Abrir turma": modules of the class with ↑/↓/Remover, "Lições avulsas", students, "Ver desempenho da turma →".
- Alunos: create form, filter by class, "Tag NFC" panel: "O progresso fica ligado ao aluno, não à tag: trocar a tag não
  apaga o histórico." with history "Vinculou a tag E2E-TAG-1". Clear.
- Painel: cards ALUNOS 1 / PROGRESSO MÉDIO 91% / MELHOR PONTUAÇÃO MÉDIA 90 / TEMPO TOTAL 2min 00s; the student row opens
  `/painel/aluno/1` with every lesson, scores and an activity log ("Desafio pontuado · Lição 9 … · 90 pontos · 30s").

#### T2-06 (Minor): "90 / melhor de 9" in the Painel row is ambiguous
- Where: Painel → table column PONTUAÇÃO (`shots/s20_Painel.png`).
- Evidence: the cell reads "90" with "melhor de 9" under it. It means "best of 9 scored challenges" but reads as "90, the
  best of 9 (points?)". Fix: "melhor nota: 90 (9 desafios)".

### Export / import of a lesson
- Lições card "Exportar" downloaded `revisor-r2-jumpers.zip` containing only `lesson.json`. Picking the .zip in "Abrir
  .json" is refused with a helpful message: "Importe o arquivo lesson.json de dentro do .zip; o áudio é gerado de novo ao
  salvar." Picking `lesson.json` opened the editor with "Lição importada (substituiu a de mesmo id)."

#### T2-07 (Major): importing a lesson silently overwrites the stored lesson with the same id
- Where: Lições → "Abrir .json".
- Action: export "Revisor R2 — jumpers" (`lesson-510c6177`), change only the title in `lesson.json` to "Revisor R2 —
  jumpers (versão importada)", import it, do not press Salvar, leave via "Lições".
- Evidence: API title before = "Revisor R2 — jumpers"; right after the import, without Salvar, the API title was
  "Revisor R2 — jumpers (versão importada)" and it stayed after leaving. No confirmation dialog was raised (dialogs
  trapped: none), the only message was "Lição importada (substituiu a de mesmo id)." (script `s25_import_overwrite.py`).
- Why it matters: export/import is how a teacher shares or backs up a lesson. Importing an older backup, or a colleague's
  edited export of a curriculum example (all ids `curriculo-…`), replaces the stored lesson with no undo. By the same
  mechanism this would overwrite a curriculum example despite the editor's "use Duplicar" advice; I did not try it on a
  curriculum lesson so as not to alter the shared test data.
- Fix: when the id exists, ask "Já existe uma lição com este id: substituir / importar como cópia" and default to a copy
  with a new id (stripping `currículo`/`exemplo`, as Duplicar does); never overwrite before Salvar.

## Part 3: new problems from the round-2 changes

#### T2-08 (Major): Lição 2 (guiada) asks the prediction AFTER the student has already energized and seen the LED light
- Where: "Lição 2 — O primeiro circuito fechado (guiada)", Etapa 6 → Etapa 7 (teacher "Testar"; the same lesson is in the
  bench package).
- Action: play the lesson with "preencher com o gabarito" for the build steps (scripts `s26_l2.py`).
- Evidence: Etapa 6 reads "Montagem certa! Agora clique em Energizar e confira se funciona." The gabarito does not pass
  it; only Energizar does, and the board then shows "Desligar" and "15,0 mA no LED (limitada pela bancada)" with "Conferi
  o circuito inteiro: todas as ligações estão certas. Clique em Continuar." Etapa 7 is then "Pense antes de testar. …
  Antes de energizar: o que você espera que aconteça com o LED?" with "Ele acende, porque o caminho está completo." The
  stored step order confirms it: step 6 `connect_circuit` "Agora confira o circuito inteiro e clique em Energizar para
  ver o LED acender.", step 7 the prediction, step 8 the experiment. The student has seen the answer before predicting,
  and step 6's text even states it ("para ver o LED acender").
- Contrast: in Lição 5 (guiada) the `connect_circuit` step passes without energizing ("Conferi o circuito inteiro: todas
  as ligações estão certas. Clique em Continuar."), and the prediction at Etapa 9 comes before the first Energizar, which
  is correct. Lessons 4 and 7 have the same step layout as 5 (prediction right after "Confira o circuito."); I read their
  step lists but did not play them.
- Fix: in Lição 2, drop the energize requirement from step 6 (text "Confira o circuito inteiro.") so that the first
  Energizar happens in the experiment after the prediction; or move the prediction before step 6.

#### T2-09 (Minor): in Lição 2 (desafio) the full hint arrives after the first wrong move, not the second
- Where: "Lição 2 — O primeiro circuito fechado (desafio)" (settings `hintAfter: 2`).
- Action: open in Testar, click one piece once (rotates it; one board change), read the mascot bubble. Repeated 3 times
  (twice clicking the LED, once the battery).
- Evidence: every time, after the first click the bubble showed the full hint "O circuito está aberto: a corrente não
  consegue dar a volta. Siga o caminho a partir da bateria e veja onde ele para." The teacher note promises "A dica só
  aparece depois que o aluno erra duas vezes seguidas, seja qual for o erro." In "Lição 4 (desafio)" (also `hintAfter: 2`)
  the counter does work: after a correct state, one wrong click gave "Ainda não é isso. Observe o circuito com calma e
  tente de novo." My guess (not verified) is that the random missing-jumper start of L2 counts as a first miss.
- Fix: reset the miss streak after the randomised start is placed; add a test with `hintAfter: 2` on a randomised start.

#### T2-10 (Minor): the editor and one note still say hints wait for "erros iguais" (same mistakes)
- Where: editor → "Opções avançadas" → "Dar a dica só depois de [—] erros iguais seguidos (vazio: dar a dica sempre)";
  note of "Lição 4 (desafio)": "A dica só vem depois de dois erros iguais seguidos."
- Evidence: the change list says consecutive misses of any kind now count, and the player code does exactly that
  (`src/player/LessonPlayer.tsx` l. 539–542: "Consecutive misses count whatever the mistake was"; the streak counter
  ignores the category). The comment two lines above (l. 529, "the same mistake happened that many times in a row") is
  stale too. I did not build a two-different-mistakes run in the UI. The L2 note already says "seja qual for o erro"; the
  editor label and the L4 note do not.
- Fix: "Dar a dica só depois de [n] erros seguidos (de qualquer tipo)"; update the L4 note.

#### T2-01 (Minor, remainder of T-04): in-app navigation leaves the editor without asking
- Where: lesson editor with unsaved edits → top nav "Lições" (also "← Todos os módulos" on the module page, T2-03).
- Action: open a saved lesson, change TÍTULO (banner appears), click "Lições" (dialogs trapped, `confirm` would answer
  "Cancelar").
- Evidence: URL went straight to `/home`; no `confirm`/`alert`/`prompt` was called; the API title stayed unchanged
  (edit lost). `history.back()` also left without a dialog. The banner does warn beforehand, which is why I rate this
  Minor.
- Fix: block route changes while dirty with "Sair sem salvar? / Salvar e sair".

#### T2-11 (Minor, honesty): "15,0 mA no LED (limitada pela bancada)" says the bench limits current
- Where: player, Lição 2 (guiada) Etapa 6 after Energizar; L6 note "a bancada limita a corrente em 15 mA, por isso o
  mínimo é 220 Ω"; L2 notes "A tela avisa que a bancada está limitando a corrente".
- Evidence: the editor's own option text is accurate: "Permitir LED sem resistor (simplificação didática) — A simulação
  limita a corrente em 15 mA." The player label attributes the cap to the physical bench. The code
  (`src/engine/sim.ts`, `BENCH_LIMIT_MA = 15`, comment "The routing hardware caps every branch at this current") shows it
  is a simulator constant, and I saw no measured evidence that the bench limits at 15 mA. A teacher could repeat "a
  bancada protege o LED" to students.
- Fix: "15,0 mA no LED (limite simulado de 15 mA)", and say in the notes that the 15 mA limit is the design target,
  not measured.

#### T2-12 (Note): small leftovers in the notes
- L8 notes (all three): "Não existem gravações do buzzer real no repositório": "repositório" is developer language
  (say "ainda não temos gravações do buzzer real").
- L1 notes: "Como saber que deu certo: a cápsula da bateria encaixada, confirmada pelo LED de status da própria bancada."
  The next line correctly says the LED is drawn on screen; the first line reads as if the physical LED confirms it.
- L9 guided note contains the challenge description too ("Desafio — bancada com DOIS erros …"), harmless.

#### T2-13 (Note): bench and dashboard state the phone/Bluetooth path as a working fact
- Painel: "Os dados chegam quando o app do professor sincroniza com a bancada." Module page: "O envio à bancada é feito
  pelo aplicativo do professor, no celular, por Bluetooth." The bench code has "Aguardando o app do professor
  (Bluetooth)." (`src/bench/BenchApp.tsx`; I did not see that screen because the test bench already had a package). In
  this environment the data came from the simulated bench service, and I could not check the phone app. If BLE delivery
  hasn't been tested end to end, add "(em teste)" or similar.

#### T2-14 (Note): "Lição 4 (desafio)" accepts flipping the battery instead of the LED
- Action: Testar → click the battery once. Evidence: "Montagem certa! Agora clique em Energizar e confira se funciona."
  That's electrically correct (both reversed means the LED is forward-biased), but the lesson's goal is LED polarity. A
  teacher may want a follow-up question ("o que você girou?"). No change required.

#### T2-15 (Note): the bench package carries the teacher notes and the answer keys
- `pacote-modulo-6-turma-1.json` includes `teacherNotes` and `correctId` for each quiz. The answer keys are needed
  offline; the notes are not. Strip `teacherNotes` from the package.

### Verified FIXED from the change list (new behaviour works)
- Time-out in a timed challenge (was T-17): authored "Revisor R2 — desafio com tempo 3 s" (Desafio, field "sem limite"
  set to 3, then an Explicação step), Testar, waited 5 s: "⏱ 0 s", "O tempo acabou! Vamos para a explicação, e depois
  você pode tentar de novo com “Testar de novo”." and a "Continuar" button that led to "Etapa 2 de 2" with the
  explanation. (Minor a11y: that time-limit number input has no label; only its placeholder says "sem limite".)
- Prediction questions present in L2/L4/L5/L7 guided (step lists read from the API; L2 and L5 played). The L2 order is
  wrong (T2-08).
- The board help panel ("Entenda a bancada e as telas", in the player) now explains nodes, mA, V, Ω, µF and E1–E6, and
  says "Esta tela é uma simulação: os valores e efeitos mostrados não são medições da bancada física."
- Column numbers are drawn on the board (1–11 in page text for both banks).
- The colour-coded resistor is gone: tray shows only 220 Ω / 470 Ω / 1 kΩ; 20 lessons; no bonus lessons.

## Ranked findings

| Rank | ID | Sev | Where | Summary |
|---|---|---|---|---|
| 1 | T2-08 | Major | Lição 2 (guiada), Etapas 6→7 | The prediction "Antes de energizar…" comes after the student was forced to energize and saw the LED light |
| 2 | T2-07 | Major | Lições → "Abrir .json" | Import overwrites the stored lesson with the same id immediately, no confirm, no undo (could hit curriculum examples) |
| 3 | T-09 | Major (partial) | Module page "Pacote para a bancada" | Now honest that the site doesn't talk to the bench, but the phone app is unnamed and unlinked, and Bluetooth delivery is stated as working |
| 4 | T2-11 | Minor | Player "(limitada pela bancada)", notes L2/L6 | The 15 mA simulator cap is attributed to the physical bench |
| 5 | T2-09 | Minor | Lição 2 (desafio) | Full hint after the first wrong move despite `hintAfter: 2` and the note "depois que o aluno erra duas vezes" |
| 6 | T2-01 | Minor | Editor → nav links | Unsaved edits are dropped on in-app navigation without a confirm (banner warns beforehand) |
| 7 | T2-03 | Minor | Module page | Order/classes save instantly; title needs "Salvar módulo", which gives no feedback; title edit lost on leaving |
| 8 | T2-10 | Minor | Editor "Opções avançadas", L4 desafio note | "erros iguais seguidos" no longer matches the any-kind miss counting |
| 9 | T2-04 | Minor | Module/class lesson pickers | Lessons listed 10→1; "(cópia) (desafio)" doubled type |
| 10 | T2-02 | Minor | Lições → Duplicar | No confirmation, no navigation, no "Cópia de …" note |
| 11 | T2-06 | Minor | Painel row | "90 / melhor de 9" is ambiguous |
| 12 | T-05 | Minor (partial) | Editor step questions | Question editor now open and labelled, still far from its step |
| 13 | T-10, T-14 | Minor | Chips; save message | Still "exemplo (20)" = "currículo (20)"; still "(TTS desligado.)." |
| 14 | T2-05 | Note | Bench screen | A website-built module has no path to the bench without the phone app; the JSON's use is not explained |
| 15 | T2-12 | Note | Notes L1, L8 | "repositório"; "LED de status da própria bancada" |
| 16 | T2-13 | Note | Painel, module page, bench idle text | Phone/Bluetooth sync stated as fact; not verifiable here |
| 17 | T2-14 | Note | Lição 4 (desafio) | Flipping the battery also passes (electrically right, off-goal) |
| 18 | T2-15 | Note | Bench package | Contains `teacherNotes` |

Round-1 majors: T-01 FIXED, T-02 FIXED, T-03 FIXED, T-04 PARTIAL (→ T2-01, Minor), T-05 PARTIAL (Minor now), T-06
FIXED, T-07 FIXED, T-08 FIXED, T-09 PARTIAL. Round-1 minors seen: T-17 FIXED, T-18 FIXED, T-20 FIXED, T-21 FIXED, T-16
PARTIAL, T-10 and T-14 NOT FIXED.

## What works (verified this round)
- Login, Lições in teaching order with the "Começando agora?" hint; own lessons first.
- Teacher notes: Objetivo / Como saber que deu certo / Simulação in every one of the 20, with no developer jargon.
- Generated jumper steps use tray names and follow a swapped jumper (editor, API and player agree).
- Save validation lists every problem with numbers that match the screen; nothing is stored when refused.
- Unsaved banner in the editor; "Testar" on an unsaved lesson says so; "Voltar ao editor" keeps edits.
- Duplicate strips `currículo`/`exemplo`, gets new quiz ids, leaves the original byte-identical; curriculum editors warn
  "Esta é uma lição de exemplo do currículo…".
- Modules: create, add lessons, ↑/↓ reorder (end arrows disabled), assign to "E2E currículo", persist across reload,
  "Baixar pacote" gives a complete JSON (module, class, lessons, students).
- Turmas page (modules, standalone lessons, students), Alunos (create form, NFC tag panel with history), Painel (class
  cards, per-student page with per-lesson status and activity log).
- Bench screen: unknown tag refused politely; E2E-TAG-1 logs in, lists the 20 lessons with status, starts a lesson;
  Ranking per challenge; Câmera reports the missing permission honestly.
- Export gives a .zip with `lesson.json`; importing the .zip is refused with a clear instruction; importing the JSON
  works (but see T2-07).
- Timed challenge time-out → "Continuar" → the explanation.
- Honesty: editor help, board help panel, capsule legend, experiment step and status-LED option all say the values are
  simulated and not measured; resistor bands say "(ilustração; não é leitura da câmera)" (source string). No screen I
  opened claims camera recognition or measured hardware, apart from T2-11 and the unverified Bluetooth/sync wording
  (T-09, T2-13).

## Not verified
- Whether the phone app's Bluetooth delivery or sync works with a real bench (no phone/BLE here). The bench idle screen
  "Aguardando o app do professor (Bluetooth)" was seen only in source, not on screen.
- Whether a module built on the site can reach the running bench screen by any path other than the phone app.
- The real browser "leave page?" prompt on reload/close (only a synthetic `beforeunload` event was checked).
- Lessons 4 and 7 (guiada) were not played; their prediction order was judged from the stored step list only.
- Whether the any-kind miss counting works across two *different* mistakes in the UI (only code read, and same-kind
  sequences played).
- The root cause of T2-09 (my randomised-start hypothesis is unconfirmed).
- Overwriting a curriculum lesson via import (deliberately not tried, to keep the shared data intact).
- Sound/TTS (headless; TTS off), camera image, mobile/narrow layout, the student view of an imported or duplicated lesson
  on the bench.

## Test data I created (isolated DB; nothing deleted)
- Lessons: `lesson-510c6177` "Revisor R2 — jumpers" (title later changed by the import test to "Revisor R2 — jumpers
  (versão importada)"), `lesson-0ef94527` "Lição 3 — … (desafio) (cópia)", two "Revisor R2 — desafio com tempo…"
  lessons (one without and one with a 3 s limit) and a "(cópia)" of the 3 s one.
- Module 6 "Revisor R2 — minha trilha" (jumpers, Lição 2 guiada, L3 copy), assigned to "E2E currículo". This lowers
  the class's Painel progress to 20/22.
- On the bench service: one start of "Lição 2 (guiada)" by E2E-TAG-1 (not finished).

