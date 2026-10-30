# Round 1: teacher critic review (interrupted)

Reviewer: teacher critic (Claude Opus 5.5, `claude-opus-5-5`), 2026-10-30.
Scope: `AI/teacher-critic.md`, run against the teacher site (http://127.0.0.1:5180), the API (:8010) and the isolated SQLite curriculum.
Status: **interrupted** while doing area 5 (Modules). The computer was suspended, the servers and the scratchpad went down, and the screenshots referenced during the session are lost. Everything under "Confirmed" was reproduced in headless Chrome via `graph_validator/tools/cdp.py`, and where stated, checked against the API (`GET /workspace/lessons`, `/workspace/modules`). All quotes are exact on-screen pt-BR text.

Test data I created in the isolated DB. Nothing was deleted.
- `lesson-d13925c9` "Teste professor — LED com resistor" (guided)
- `lesson-9b48421d` "Teste professor — desafio LED invertido" (challenge, faulty start bench, 90 s limit)
- `lesson-fc45626a` "Lição 3 — Limitando a corrente: o resistor (desafio) (cópia)" (duplicate, first question edited)
- `lesson-f5b278b3` "Teste professor — só teoria" (no circuit)
- module id 6 "Teste professor — minha trilha" (created, still empty: I had not yet added lessons or assigned a class)

Incident (not a product finding): to clear my own hung Chrome I ran `pkill -f cdp-profile`. That pattern can also have killed the student critic's Chrome at about 14:05. I reported it to the coordinator at the time.

---

## Confirmed findings

| ID | Sev | Area | Where | Summary |
|---|---|---|---|---|
| T-01 | major | 3 Author | Editor, generated build steps | A jumper step's text goes stale when you swap the jumper, so the student is told to place the wrong piece |
| T-02 | major | 3 Author | Editor, generated jumper steps | Jumper "colunas" counts in step texts don't match the tray names ("Jumper longo" → "2 colunas", "Jumper curto" → "1 colunas") |
| T-03 | major | 3/6 Author | Editor, save validation | The save error says "Pergunta 2", but both question blocks on screen are labelled "Pergunta 1" |
| T-04 | major | 3 Author | Editor | Unsaved changes are lost silently when you leave the editor. "Testar" plays the unsaved version, which looks like a successful save |
| T-05 | major | 3 Author | Editor, step questions | The question body for a step question sits in a collapsed `<details>` ("Perguntas dos passos de interação"), far from the step |
| T-06 | major | 4 Adapt | Lições list after "Duplicar" | The copy keeps the tags `currículo` and `exemplo`, so it counts as an official example ("exemplo (23)") |
| T-07 | major | 1 First impression | Lições list | No suggested order: cards are sorted by last update (Lição 9, bônus, 3, 1, 10, …). Nothing says where to start |
| T-08 | major | 1 First impression | Notas do professor (all 22) | The notes are full of developer jargon (Notion, git, internal setting names, file names) |
| T-09 | major | 5 Modules | Module page, "Pacote para a bancada" | The site cannot send anything to a bench. The text points to an unnamed "app do professor … por Bluetooth" |
| T-10 | minor | 1 | Filter chips | "exemplo (22)" equals "Todas (22)", so the label explains nothing. 36 chips sit above the cards |
| T-11 | minor | 1/3 | Filter chips vs card type | The type filters are tags, not the lesson type. A teacher's untagged DESAFIO lesson doesn't appear under "desafio" |
| T-12 | minor | 1 | Lição 10 card | Title "Desafio de integração" but labelled "LIÇÃO GUIADA". There's no challenge version |
| T-13 | minor | 3 | Editor, after a piece is removed | Shows "Validador: passos corretos" at the same time as "A peça deste passo não está mais na bancada. Exclua o passo." |
| T-14 | minor | 3 | Save / player status text | "Sem voz do tutor (TTS desligado.)." uses jargon and doubled punctuation |
| T-15 | minor | 3 | SVG upload | An invalid file triggers a blocking browser `alert()`. To replace an illustration you must click "remover ilustração" first |
| T-16 | minor | 5 | Module page, lesson picker | Options repeat the type ("… (guiada) (guiada)") and are sorted by update time, not lesson number |
| T-17 | minor | 6 | Challenge time limit | When time runs out the student is blocked, and the explanation that follows never shows. There's no option for what happens on timeout |
| T-18 | minor | 4 | Duplicate | The copy reuses the original's quiz IDs (`curriculo-03-desafio.q-pred`). The impact on the dashboard is unverified |
| T-19 | minor | 3 | Faulty-bench challenge, player | A pre-assembled faulty bench shows "Monte o circuito." The editor labels steps "Depois da montagem" even when the student builds nothing |
| T-20 | minor | 1 | Card stats | "1 perguntas", "1 peças", "1 passos" (plural with 1) |
| T-21 | note | 3 | Editor accessibility | Both question prompts get `aria-label="Enunciado da pergunta 1"` (step list and standalone list number separately) |

### T-01: a stale jumper step text sends the student to the wrong piece (major)
- **Repro:** Lições → "Nova lição". Build battery A1, 470 Ω A3, LED A5, Jumper longo A1, Jumper curto A4, Jumper 5 colunas A2. Click "Gerar passos", then Salvar. Reopen the editor, drag "Jumper 5 colunas" off the board (the step shows "A peça deste passo não está mais na bancada. Exclua o passo."). Drag "Jumper 4 colunas" to A2 and Salvar. Then Testar.
- **Observed:** the editor rebinds the step to the new piece (step label "Colocar jumper · Jumper 4 colunas"). The saved step text is still "Coloque um jumper de 5 colunas na bancada. As conexões serão conferidas no passo final." (API: step `pieceId: p6`, piece `type: jumper_4`). In the player at "Etapa 6 de 10", the mascot bubble shows "Coloque um jumper de 5 colunas na bancada…" while the expected piece is the 4-column jumper.
- **Component:** teacher_authoring_app editor step generation/rebinding (`src/editor/StepsEditor.tsx`, `src/model/steps.ts`, likely).
- **Fix:** regenerate the default text when the bound piece changes, or flag a mismatch between text and piece.

### T-02: jumper size words in generated steps contradict the tray (major)
- **Repro:** same build, then "Gerar passos".
- **Observed:** for "Jumper longo" (saved a=1, b=3) the step says "Coloque um jumper de 2 colunas na bancada." For "Jumper curto" (a=4, b=5) it says "Coloque um jumper de 1 colunas na bancada." For "Jumper 5 colunas" (a=2, b=7) it says "jumper de 5 colunas". The tray names are "Jumper curto", "Jumper longo", "Jumper 3/4/5 colunas", so a student can't map "2 colunas" to a tray item. On the board, the "longo" piece visibly covers 3 node columns. There is also the "1 colunas" grammar error.
- **Fix:** use the tray's display name in step text ("Coloque o Jumper longo…"). Make the "colunas" naming consistent (span vs gap).

### T-03: the save error names a question number that doesn't exist on screen (major)
- **Repro:** "Nova lição", fill in title and instruction. "+ Explicação" (fill it in). "+ Pergunta" (top, step question). "+ Pergunta" (bottom "Perguntas" section). Fill in only the step question's prompt and alternatives. Click Salvar.
- **Observed:** both question blocks are headed "Pergunta 1" (DOM check returned `['Pergunta 1', 'Pergunta 1']`). Save is refused with "Pergunta 2: escreva o enunciado." next to the Salvar button. The lesson is not saved (API confirms). Once the second prompt is filled in: "Lição salva no banco de dados."
- **Fix:** number questions globally, or name the section ("Perguntas (antes/depois de montar) · Pergunta 1"). Scroll to and highlight the offending field.

### T-04: unsaved changes are lost with no warning, and "Testar" hides that nothing was saved (major)
- **Repro A:** open a saved lesson in the editor, change the TÍTULO, then click the "Lições" nav link.
- **Observed A:** you go straight to /home. No confirm or alert was triggered (alerts were trapped), and the API title is unchanged.
- **Repro B:** in T-03's state (save refused), click "Testar".
- **Observed B:** the unsaved lesson plays fully ("Lição concluída! É assim que o aluno vai passar por ela."). The only hint is "Sem áudio: salve a lição para gerar a voz." The lesson did not exist in `/workspace/lessons`. Likewise, changing the time limit to 4 s and pressing Testar used 4 s while the DB kept 90.
- **Fix:** guard route changes and `beforeunload` when there are unsaved edits. Show a "não salvo" banner in the test player.

### T-05: the question editor is hidden in a collapsed section (major)
- **Repro:** guided lesson → "+ Pergunta depois do passo 3".
- **Observed:** the step card shows "Pergunta" with no fields. The editor lives in `<details>` "Perguntas dos passos de interação", which is closed by default (`open:false`). The "+ alternativa" button and prompt only appear after you expand it. In challenge mode the step says "Edite a pergunta em 'Perguntas dos passos', abaixo." There are also two separate "+ Pergunta" buttons (step vs. "Perguntas" section) with no explanation of the difference ("Antes de montar / Depois de montar" only shows on the second).
- **Fix:** edit the question inline in its step card, or auto-open and scroll to it. Explain the two question kinds.

### T-06: a duplicated lesson masquerades as an official example (major)
- **Repro:** Lições → card "Lição 3 — Limitando a corrente: o resistor (desafio)" → "Duplicar".
- **Observed:** a new card "Lição 3 — … (desafio) (cópia)" appears, with the tags currículo, desafio, previsão, comparação, experimento, exemplo. The chips became "currículo (23)" and "exemplo (23)", while the help still says "filtre pela etiqueta exemplo: as 22 lições do currículo". There's no confirmation message and no navigation to the copy. The editor of the copy shows nothing saying it is a copy of X (only the title suffix). The original stays untouched: the API JSON md5 was identical before and after editing the copy (`d1717530…`). The original curriculum lessons can still be edited and saved with no warning (the editor showed Salvar with no "exemplo/somente leitura" notice).
- **Fix:** strip `exemplo`/`currículo` on duplicate. Open the copy in the editor with "Cópia de …; o original não muda." Warn (or make read-only) when editing a curriculum example.

### T-07: the lesson list has no suggested order or entry point (major)
- **Observed:** card order is by last update: "Lição 9 (guiada), Lição bônus (guiada), Lição 3 (guiada), Lição 1 (guiada), Lição 10 (guiada), Lição 9 (desafio), …". Nothing on the page says start with Lição 1, or that the guided version precedes the challenge. The proper order only appears in Módulos ("Currículo completo — Fundamental II … na ordem da página").
- **Fix:** sort by curriculum order (or offer a sort option). Add a "Comece por aqui" hint linking to the 22-lesson module.

### T-08: teacher notes are written for developers (major)
- **Observed (quotes):** "Critérios (Notion): …", "Esquema recuperado do histórico do git (esquematico_modulo_09_seguranca.png)", "Com settings.ccLimited os discos só alternam…", "(hideColorKey). O valor é conferido por matchValues.", "(hintAfter: 2)", "(configuração allowNoResistor)", "o motor da simulação conhece 4 posições por disco (cores do catálogo EFR12)". The module description says "Todas as lições do Notion “Guided Lessons and Challenges”". On the positive side, every note has Objetivo, a criterion and a "Simulação: …" line.
- **Fix:** rewrite in teacher language (objective, success criterion, duration, prerequisites, what is simulated). Move the provenance notes to a developer field.

### T-09: there is no way to send to a bench from the website (major)
- **Repro:** Módulos → "Novo módulo" (title/description) → "Criar módulo" → module page.
- **Observed:** the section reads "Pacote para a bancada — O app do professor envia este pacote à bancada por Bluetooth. Aqui você pode baixar o mesmo pacote (JSON) para conferência." The only control is "Baixar pacote" (disabled until a class is chosen). The Módulos page header says "envie-os à bancada pelo app". There's no link to, or name for, "o app do professor".
- **Also an honesty concern:** this implies a working Bluetooth delivery path. I had not verified whether it exists or was tested.
- **Fix:** name the app and link to it, or say plainly how the bench gets the module (the bench screen downloads it by class/tag?). Mark Bluetooth delivery as not yet available if it isn't.

### T-10 to T-21 (minor and note)
- **T-10:** chips "Todas (22)", "currículo (22)", "exemplo (22)" are identical sets. 36 chips are shown (s1 screenshot). No legend explains "exemplo", "ajuda mínima", "sem referência", etc.
- **T-11:** I created "Teste professor — desafio LED invertido" (TIPO = Desafio, no tags). The card shows "DESAFIO" but the chip "desafio (11)" (10 curriculum + the copy) excludes it.
- **T-12:** card "LIÇÃO GUIADA / Lição 10 — Desafio de integração: o alarme (guiada)".
- **T-13:** both strings were visible at the same time after removing a piece that a step was bound to.
- **T-14:** after Salvar: "Lição salva no banco de dados. Sem voz do tutor (TTS desligado.)." The player header shows "Sem áudio (TTS desligado.)."
- **T-15:** for bad.svg (plain text) and img.png I got `alert("Use um arquivo .svg (começando em <svg>) de até 60 KB.")`. The valid SVG previewed and played correctly. After a successful upload the file input disappears until you click "remover ilustração". An SVG with `<script>`/`onload` was accepted but rendered as `<img src="data:image/svg+xml…">`, so the script did not run (`window.__pwned` undefined). That's good, but I had not checked whether the bench/student player inlines it.
- **T-16:** "Lição 9 — Segurança: curto-circuito e mau contato (guiada) (guiada)".
- **T-17:** with a 4 s limit: "⏱ 0 s" then "O tempo acabou! Clique em “Testar de novo” para tentar outra vez." The explanation step after the build is never reached.
- **T-18:** the copy's quizzes keep the ids `curriculo-03-desafio.q-pred` / `q-obs` (API).
- **T-19:** in my challenge with "LED invertido", the bench starts fully assembled, yet the step text says "Monte o circuito." The success text was "Muito bem! Este passo está certo. Circuito fechado ✓".
- **T-20:** cards show "1 perguntas", "1 peças", "1 passos".
- **T-21:** `textarea[aria-label="Enunciado da pergunta 1"]` matched two elements.

---

## Suspicions (not confirmed)
- S-1: the editor does not warn when the target circuit doesn't light. My first save had an open circuit (LED cathode at col 6, return jumper at 2→7). The editor saved it with an "Energize e veja o circuito funcionar." mission and showed no warning. I fixed the circuit before testing, so I never saw whether the student gets stuck.
- S-2: "A bancada troca internamente para o resistor certo" (bonus colour-code note) describes hardware behaviour, but the capsules are passive. It could read as a verified hardware claim. Wording to check against the electronics design.
- S-3: the colour-code note lists 420 Ω / 4,2 kΩ values. That arithmetic matches the described discs, but these aren't standard resistor values. A teacher may be confused.
- S-4: quiz IDs shared between the original and the copy (T-18) may mix answers in "Painel".

## Not yet checked (interrupted)
- Area 5 remainder: adding lessons to module 6, reordering, assigning to "E2E currículo", saving. The 22-lesson module page (readability beyond the list view, which showed "… e mais 18"). "Baixar pacote". The bench screen `/bench.html` with tag `E2E-TAG-1`: whether the class's module appears and whether a lesson starts.
- Area 7 (honesty) as a dedicated sweep of Turmas, Alunos, Painel, Sandbox and the bench screen. So far what I saw on the editor/help/notes is honest ("Os valores de corrente, brilho e som são simulados pelo software, não medidos na bancada física.", "O experimento é simulado no software: o app confere as missões; a câmera e hardware não participam.", resistor bands "(ilustração; não é leitura da câmera)", status LED "(simulado na tela)"), apart from T-09's Bluetooth wording and S-2.
- Turmas, Alunos and Painel pages were not opened at all.
- Export (.zip/.json), "Abrir .json" import, Excluir.
- Whether "Voltar ao editor" keeps unsaved edits.
- Sound or TTS (can't be heard in headless mode, and TTS is off).
- Mobile/narrow layout.

## What works well (verified)
- The help "Como criar uma atividade (e que tipos existem)" names every activity type and states that values are simulated.
- Authoring end to end worked: build by drag, "Gerar passos", explanation with SVG (+ alt/caption fields after upload), a question with 3 options and per-option feedback, an experiment with a mission. Saved and persisted (API), reloaded intact (tags persist when actually typed), played to "Lição concluída!". The wrong answer showed "Não: a cor depende do LED.", the right one "Isso! Ele limita a corrente.", and the experiment showed "6,4 mA no LED · circuito fechado ✓" (correct (5−2)/470).
- Flexibility: (a) a question between build steps works ("+ Pergunta depois do passo 3" → played at Etapa 4). (b) a challenge with a time limit then an explanation works if finished in time (see T-17). (c) a lesson with no circuit (explanation + questions only) saves and plays.
- "Bancada inicial com defeito": "LED invertido" + "Criar bancada inicial com defeito" saved `start` with the LED a/b swapped. In play the LED stayed dark ("Sem corrente"), and rotating it lit it.
- Duplicate leaves the original byte-identical, and the edited question appears in the copy's player.
- "Nova lição" does not create a stored record until Salvar.
