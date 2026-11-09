# Round 2 — Student critic

Reviewer: student critic (playing a Fundamental II student, ~12–14 years old), model **Claude Opus 5.5** (`claude-opus-5-5`).
Date: 2026-10-31. Environment: teacher lesson test player at http://127.0.0.1:5180/ (Lições → card → **Testar**) and
bench screen http://127.0.0.1:5180/bench.html?servico=http://127.0.0.1:8766, driven with headless Chrome
(`graph_validator/tools/cdp.py` + `lab_driver.py`). Scripts and screenshots live in the session scratchpad
(`/tmp/claude-1000/-home-gustavo-Documents-UTFPR-oficinas-integration-workshop-3/710a118f-9d89-45f9-9efc-d49f703e7864/scratchpad/`).

Status: complete (wrapped up on request; see "Not verified").

---

## 1. Re-check of round-1 Major findings

| R1 ID | Verdict | Evidence observed in round 2 |
|---|---|---|
| S-01 (L2 LED without resistor shows a calm "15,0 mA ✓") | **FIXED** | L2 guided step 6, after building by drag and Energizar: "15,0 mA no LED (limitada pela bancada)" + "⚠ circuito fechado, mas sem resistor: a bancada está segurando a corrente. Um LED sozinho, sem esse limite, poderia queimar." Step 1 now says "(Atenção: só aqui o resistor fica de fora. Na próxima lição você vai descobrir por que ele é importante.)". Small leftovers in N-03. |
| S-02 (four different numbers for the 470 Ω + LED current) | **PARTIAL** | L3 guided (gabarito build) step 9: capsule "AMPERÍMETRO · 6,25 mA", status line "6,3 mA no LED". The step-10 question now says "um valor perto de “6 mA”" (no longer quotes a number the student never saw). But the capsule and the status line still disagree (6,25 vs 6,3), step 11's formula "(5 V − 2 V do LED) ÷ resistência" gives 6,4, and L4 guided shows **"6,4 mA no LED"** for the same 470 Ω + LED circuit (no ammeter). Nothing explains why the number changed. |
| S-03 (challenge bubble says "Monte o circuito." on an already built circuit) | **FIXED for fault challenges; NOT FIXED for L1 desafio** | L2, L4 and L9 desafio bubbles: "Encontre o que está errado no circuito e conserte." But L1 desafio still shows only **"Monte o circuito."** as goal and bubble, with one battery in the tray; dropping the battery anywhere (B6) → "Muito bem! Este passo está certo." → "Lição concluída!". It never mentions nodes, so there is no real challenge (see N-16). |
| S-04 (no graded hint after repeated failures in challenges) | **NOT FIXED** | L2 desafio (test player): 4 wrong jumpers + Energizar, 4 more Energizar, 3 more drops → every time "Ainda não é isso. Observe o circuito com calma e tente de novo." L4 desafio (test player): resistor rotated/back, 2 stray jumpers, 7 Energizar → same sentence. **L4 desafio on the bench screen** (tag E2E-TAG-1): 4 resistor rotations + 5 Energizar → same sentence every time, no hint, no "Pedir dica". |
| S-05 (empty "Muito bem! Este passo está certo." steps) | **PARTIAL** | The extra step after the last jumper now says **"Conferi o circuito inteiro: todas as ligações estão certas. Clique em Continuar."** (L1 step 5, L4 step 7, L5 step 8, L6 step 7, L7 step 8, L8 step 7, L8 pot step 7, L10 step 12), so it no longer looks like a glitch. It is still a click with no action, and in **L1** it is wrong: only a battery is on the board, and step 7's feedback says "ainda não existe nenhum circuito para acender" (N-17). L1 step 6 "Olhe o LED de status" is already "Missões cumpridas!" on arrival. |
| S-06 (LED arrow does not flip when rotated) | **FIXED** | L4 guided step 9, 4× zoom: before "▶ A K" with dark bar at K; after one click "◀ K A" with the dark bar moving to the K side (`…/shots/l4_led_before.png`, `l4_led_after.png`). The bar is now a dark, clear line. |
| S-07 (colour-code challenge prints the value) | **N/A — removed** | The colour-code resistor and bonus lessons are gone: lesson list shows 20 lessons, L1–L10 only; no "Resistor código de cores" in any tray I opened. |

## 2. New findings

Common repro prefix: log in as `professor@tedtronics.local` / `tedtronics` → Lições → lesson card → **Testar**.
"Drag" = real pointer drag from the lesson tray (Bandeja) onto a hole, done with pointerdown/pointermove/pointerup.

### N-01 — Major — build steps say "Muito bem! Este passo está certo." for jumpers that connect nothing (L2 guided steps 4–5)
* **Where:** L2 guided, step 4 ("Use um jumper para ligar o + da bateria ao lado “+” do LED.") and step 5 ("Use outro
  jumper para ligar o lado “−” do LED de volta ao − da bateria.").
* **Action:** drag Bateria 5 V to A2 (it lands on columns 2–3), drag LED to A5 (columns 5–6), then on step 4 drag
  **Jumper longo** to A2 row 2 (it covers columns 2–4, so it does *not* reach the LED at column 5). On step 5 drag the
  second Jumper longo to **B8** (columns 8–10, nowhere near the circuit).
* **Evidence:** after each drop the tutor bubble turns green: **"Muito bem! Este passo está certo."** With "Depurar
  validação" ticked, step 5 shows "Ligações esperadas: bateria[bat].+ = led[led].anode …", "Ligações na bancada:
  bateria[p1].+ / bateria[p1].- / led[p2].anode / led[p2].cathode" (nothing connected) and then **"O validador aprovou o
  circuito desta etapa."** Only at step 6, after Energizar, the status says "Sem corrente" and the tutor just repeats
  "Agora confira o circuito inteiro e clique em Energizar para ver o LED acender." (no hint which jumper is wrong; the
  "Circuito aberto: jumper" diagnosis is visible only in the teacher debug panel).
* **Why it matters:** a child is told twice that a wrong wire is right, then the circuit doesn't work and nothing says
  where the mistake is. This undoes the lesson's point ("o caminho tem que ser completo").
* **Fix:** in intermediate build steps check the connections the step asks for (here bat.+ = led.anode), not only that a
  piece of the right type was added. When the full circuit is open at the Energizar step, say it in the bubble (for
  example "A corrente não chega ao LED: siga o fio do + e veja onde ele termina").

### N-02 — Major — the new L2 prediction question comes *after* the student already saw the LED light (L2 guided step 7)
* **Where:** L2 guided, steps 6 → 7.
* **Action:** finish the build, step 6 asks "Agora confira o circuito inteiro e clique em Energizar para ver o LED
  acender." → Energizar (LED lights, "15,0 mA no LED (limitada pela bancada)") → Continuar.
* **Evidence:** step 7 is **"Pense antes de testar. … Antes de energizar: o que você espera que aconteça com o LED?"**
  with "Ele acende, porque o caminho está completo." / "Ele não acende…" / "Ele só pisca." The student has just
  energized and watched it light on step 6, so there is nothing left to predict. Correct answer → "Isso! Vamos conferir
  energizando." Wrong answer ("Ele só pisca.") → "Vamos observar com calma: ele pisca ou fica aceso?" and the student
  cannot continue until picking the "right" prediction.
* **Fix:** move the prediction before step 6's first Energizar (or make step 6 "Montagem certa!" without energizing),
  and accept any prediction (a prediction is not a test): show "Vamos ver se você acertou" and compare after the
  experiment.

### N-03 — Minor — L2 mission text still promises "circuito fechado ✓" but the status now shows a warning
* **Where:** L2 guided step 8, Missões.
* **Action/evidence:** mission "Energize e veja o LED acender com “circuito fechado ✓”." gets ticked while the status
  reads "15,0 mA no LED (limitada pela bancada) ⚠ circuito fechado, mas sem resistor: a bancada está segurando a
  corrente. Um LED sozinho, sem esse limite, poderia queimar." (no ✓ anywhere). At step 6 the tutor bubble is green
  "Muito bem! Este passo está certo." right above the same ⚠ warning.
* **Fix:** reword the mission to "Energize e veja o LED acender" and keep the tutor bubble neutral/orange while the
  ⚠ is shown ("Funcionou — mas veja o aviso: sem resistor a bancada está protegendo o LED").

### N-04 — Major — two jumpers side by side on unused columns make a correct circuit show "Sem corrente"
* **Where:** L2 desafio (the simulator; probably every lesson).
* **Action:** L2 desafio → drag the missing **Jumper longo** to A2 row 5 (columns 2–4). Energizar → "15,0 mA no LED
  (limitada pela bancada)" (works). Desligar → drag a **Jumper curto** to B9 (columns 9–10) → Energizar → still 15,0 mA.
  Desligar → drag a **second Jumper curto** to B9 on another row (same two columns, nothing else connected) → Energizar.
* **Evidence:** status becomes **"Sem corrente"** and the LED stays off, while the tutor bubble says **"Montagem certa!
  Agora clique em Energizar e confira se funciona."** and the teacher debug panel says "O validador aprovou o circuito
  desta etapa." Dragging one of the two stray jumpers out → Energizar → 15,0 mA again. Reproduced twice (A10–A11 pair
  and B9–B10 pair). Screenshot: `…/scratchpad/shots/l2d_parallel_bug.png`.
* **Why it matters:** a child who tries a few extra wires (normal when hunting a fault) ends up with a correct circuit
  that the bench calls dead and the tutor calls right. There is no way to understand that.
* **Fix:** the simulator must ignore (or handle) loops of jumpers that are not connected to the battery; add a test
  with two parallel jumpers on an isolated pair of columns.

### N-05 — Note — L2 desafio ends with no "why" question
* **Where/action:** L2 desafio, after fixing the jumper → Continuar.
* **Evidence:** goes straight to "Lição concluída!". The guided version asks "Por que a luz apagou…".
* **Fix (optional):** one closing question ("O que estava faltando no caminho da corrente?").

### N-06 — Minor — jumper names do not match their length
* **Where:** lesson tray, every lesson (seen in L2).
* **Evidence (debug panel, "Na bancada"):** "Jumper curto (colunas 9–10)", "Jumper longo (colunas 2–4)", **"Jumper 3
  colunas (colunas 7–10)"**. So "Jumper 3 colunas" covers four columns, and "longo" covers three. A student choosing by
  name picks the wrong one. 
* **Fix:** name them by the columns they reach ("Jumper 2 colunas / 3 colunas / 4 colunas") or draw the span on the
  tray card.

### N-07 — Major — prediction questions only let you continue with the "right" bet, and the next mission gives the answer away (L4 guided steps 8–9; same pattern in L2 step 7)
* **Where:** L4 guided step 8 ("Faça sua aposta antes de testar. Se você virar o LED ao contrário, o que acha que vai
  acontecer?").
* **Action:** built the circuit by drag, Energizar (6,4 mA), Continuar, then tapped "Acende do mesmo jeito.", then
  "Acende mais forte.", then "Não acende.".
* **Evidence:** "Acende do mesmo jeito." → **"Vamos testar! Gire o LED e compare nas duas posições."** but no Continuar
  button appears. "Acende mais forte." → "Vamos testar para ver se é isso mesmo." and still no Continuar. Only "Não
  acende." → "Boa hipótese! Vamos conferir testando as duas posições." + Continuar. The tutor says "let's test" and then
  does not let me test. Step 9's mission then reads **"Gire o LED e veja que, ao contrário, ele fica apagado."**, which
  tells the result before the experiment.
* **Why it matters:** this teaches "guess until it lets you through", not "predict, then check". A student who bet
  wrong never gets to see the experiment prove them wrong, which is the whole point.
* **Fix:** accept any answer on a prediction step (store it), run the experiment, then show "Você apostou X — e
  aconteceu Y". Reword the mission neutrally: "Gire o LED, energize de novo e compare."

### N-08 — Note — "Ligado ao contrário, ele bloqueia e não acende — e isso protege o LED." (L4 guided step 11)
* Reading as a 13-year-old I understood this as "putting it backwards is safe / good for the LED". 
* **Fix (optional):** "Ligado ao contrário, ele bloqueia a corrente e não acende."

### N-10 — Major — L6: the potentiometer jumps in 7 steps, but the lesson says "sem degraus" and marks "aos pulos" wrong
* **Where:** L6 guided, steps 1, 8 and 9.
* **Action:** built by drag (Bateria, Potenciômetro, LED, Jumper longo, Jumper 4 colunas), step 8 Energizar, then used
  the only control there is: the tiny "−" / "+" buttons on the piece (aria-labels "Diminuir resistência" / "Aumentar
  resistência", about 14×14 px). There is no slider or draggable knob (no `input[type=range]` / `role=slider` on the page).
* **Evidence:** each click jumps through exactly 7 values: **100 Ω → 220 Ω → 470 Ω → 1 kΩ → 2,2 kΩ → 4,7 kΩ → 10 kΩ**
  (status 15,0 → 13,6 → 6,4 → 3,0 → 1,4 → 0,6 → 0,3 mA). Step 1: "O potenciômetro é um resistor que você regula, sem
  degraus… ele tem infinitos valores". Step 8: **"Energize e arraste o controle de uma ponta à outra."** (title "Gire o
  botão"). Step 9: "Quando você girou o botão, o brilho mudou…" — the honest answer from what I saw, **"Aos pulos, em
  poucos degraus."**, gets "Passe o controle devagar: o brilho muda aos poucos, sem pulos." and only "Aos poucos e
  continuamente." is accepted.
* **Why it matters:** the student is told their own observation is wrong. It also tells them a simulated control is
  something it isn't.
* **Fix:** give the simulated pot a real continuous slider (drag) with many steps, or change the text to say the screen
  shows only a few positions of a knob that is continuous in real life, and accept/explain "aos pulos" in that case.
  Make the −/+ buttons bigger (at least 32 px) for touch.

* **Same in L8 (versão com potenciômetro):** step 1 "Do degrau à rampa … O potenciômetro permite passar por todos os
  valores no meio do caminho", step 8 "arraste o controle devagar de um lado ao outro"; the piece again only has −/+
  and jumps 100 Ω → … → 10 kΩ (14,3 mA → 0,5 mA in the buzzer).

### N-11 — Minor — at the potentiometer minimum the warning says "sem resistor"
* **Where/action:** L6 guided step 8, press "−" down to 100 Ω.
* **Evidence:** "15,0 mA no LED (limitada pela bancada) ⚠ circuito fechado, mas **sem resistor**: a bancada está
  segurando a corrente…". There is a resistor in the path (the pot at 100 Ω). Also the tray card and the piece start at
  "1 kΩ", but the piece goes from 100 Ω to 10 kΩ.
* **Fix:** "⚠ resistência pequena demais: sem o limite da bancada a corrente passaria de 15 mA". Label the tray card
  "Potenciômetro (100 Ω – 10 kΩ)".

### N-12 — Minor — L8 desafio: the answer buttons describe the sound, so you can answer without listening
* **Where/action:** L8 desafio → ▶ Clipe A, ▶ Clipe B → Continuar.
* **Evidence:** question "Qual clipe foi feito com o resistor MAIOR?" with options **"Clipe A (mais fraco e mais
  grave)."** / **"Clipe B (mais forte e mais agudo)."**. The listening part is given away in the button text. (Round-1
  P-04 is now checked: the question and feedback exist: "Isso! Mais resistência → menos corrente → som mais fraco e mais
  grave.")
* **Fix:** options "Clipe A" / "Clipe B" only, then a second question "Como você percebeu?". Shuffle which clip is the
  bigger resistor.

### N-13 — Minor — sound lessons have no on-screen cue for the sound
* **Where:** L8 guided step 8, L8 pot version step 8, L8 desafio.
* **Evidence:** the only thing that changes on screen when swapping 220 Ω / 470 Ω / 1 kΩ is "10,6 / 6,9 / 4,0 mA no
  buzzer". Questions then ask "mais fraco e mais grave". Nothing on screen shows loudness or pitch, so a student with the
  sound off, in a noisy class, or with hearing loss can't answer from observation. (I could not hear sound headless.)
  Also note that the step-9 answer teaches that a bigger resistor makes the buzzer **more grave**; the question says
  "Na simulação", but a child will generalise it to the real buzzer.
* **Fix:** add a simple visual (volume bar + "tom: grave/agudo" or Hz), and one sentence saying whether the real kit
  buzzer changes pitch or only volume.

### N-14 — Major — L10: both branches show the same current although they have different resistors
* **Where:** L10 guided step 13 ("Energize e aperte o botão: o LED e o buzzer devem funcionar juntos.").
* **Action:** built all 10 build steps by drag (Bateria, Botão, Resistor 470 Ω for the LED branch, LED, Resistor 220 Ω
  for the buzzer branch, Buzzer, 4 jumpers), Energizar, "Botão: solto" → apertado.
* **Evidence:** status **"10,6 mA no LED e no buzzer (cada ramo)"** (`…/shots/l10_pressed.png`). 10,6 mA is the 220 Ω
  buzzer value from L8; the same 470 Ω + LED gave **6,4 mA** in L4, L5, L7 and L9. The closing question then teaches
  "a corrente se divide em dois caminhos, um para cada um".
* **Why it matters:** in the lesson about parallel branches, the screen says two different branches carry the same
  current, contradicting what earlier lessons showed for 470 Ω.
* **Fix:** show each branch separately ("LED: 6,4 mA · buzzer: 10,6 mA · total da bateria: 17,0 mA"), which also
  makes the "divide" idea visible.

### N-15 — Minor — L10 promises "ajuda mínima" but behaves like every other lesson; "ponto de retorno" is never defined
* **Where/action:** L10 guided step 1 says "Você vai montar com ajuda mínima: o tutor só fala depois de dois erros
  seguidos no mesmo passo." On step 2 the bubble already says "Coloque a bateria."; I dropped a LED, then a Buzzer
  (wrong pieces) — the bubble stayed "Coloque a bateria." with no reaction at all (no "Ainda não…", nothing after two
  errors). Steps 10–11: "Jumper do buzzer ao ponto de retorno." / "Jumper do retorno ao − da bateria." The return point
  turns out to be column 6, where the LED's K already sits, but no step says so (round-1 P-01/P-02 now confirmed).
* **Fix:** either hide the instruction until two errors (as promised) or delete the sentence; say "ponto de retorno =
  a coluna onde o − do LED está (coluna 6)" or highlight it.

### N-16 — Minor — L1 desafio is "Monte o circuito." with one battery
* **Where/action:** L1 desafio → drag Bateria 5 V anywhere (I used B6) → Continuar.
* **Evidence:** goal and bubble "Monte o circuito."; after the drop "Muito bem! Este passo está certo." → "Lição
  concluída!". No question about nodes, nothing to discover. (Round-1 S-03 remainder.)
* **Fix:** give it a node goal, e.g. "Encaixe a bateria de modo que o + e o − fiquem em nós diferentes, e depois toque
  num furo ligado ao +", or a question "Quantos nós a bateria está usando?".

### N-17 — Minor — L1 step 5 says "Conferi o circuito inteiro: todas as ligações estão certas" when there is no circuit
* **Where/action:** L1 guided, drag the battery on step 4 → Continuar.
* **Evidence:** step 5 "Conferi o circuito inteiro: todas as ligações estão certas. Clique em Continuar."; step 6
  arrives as "Missões cumpridas! Você viu o efeito acontecer." without doing anything; step 7's correct-answer feedback
  says "Exato! Ele só confirma a bateria — **ainda não existe nenhum circuito** para acender."
* **Fix:** drop step 5 in L1 (or say "A bateria está encaixada."), and let step 6's mission be done on that screen.

### N-18 — Minor — timed challenge: time-out works, but the timer is tiny and the message names a teacher button
* **Where:** test player, lesson "Revisor R2 — desafio com tempo 3 s" (made by another reviewer; no curriculum lesson is
  timed, so I could not check it on the bench screen).
* **Action:** Testar, do nothing for 3 s.
* **Evidence:** while running, the only timer is a small grey **"⏱ 2 s"** under the Energizar button, beside the
  "preencher com o gabarito" link (`…/shots/timed3_running.png`). At 0 the bubble says **"O tempo acabou! Vamos para a
  explicação, e depois você pode tentar de novo com “Testar de novo”."** and a **Continuar** button appears (the
  round-2 change works); Continuar → step 2 explanation. The board stays editable after time-out (I could still drag the
  battery). "Testar de novo" is the teacher-preview button name; a student on the bench doesn't have it.
* **Fix:** show the countdown big, next to the goal (and colour it when < 10 s); word the message for students
  ("…depois você pode tentar de novo"), and lock or grey out the board after time-out so it is clear the attempt ended.

### N-09 — Note — duplicate React key warning in the teacher debug panel
* **Where/action:** L4 guided with "Depurar validação" ticked while building. **Evidence:** console: "Warning:
  Encountered two children with the same key … resistor_470[res].pin … at ValidationDebug (LessonPlayer.tsx:84)". Teacher
  only; students don't see it. **Fix:** unique keys in that list.

---

## 3. Ranked findings

| Rank | ID | Severity | Where | One line |
|---|---|---|---|---|
| 1 | S-04 (R1) | Major | All fault challenges (test player and bench) | Still no graded hint: "Ainda não é isso. Observe o circuito com calma e tente de novo." forever. |
| 2 | N-01 | Major | L2 guided steps 4–5 | Jumpers that connect nothing get "Muito bem! Este passo está certo." / "O validador aprovou". |
| 3 | N-04 | Major | Simulator (seen in L2 desafio) | Two parallel jumpers on unused columns make a correct circuit read "Sem corrente" while the tutor says "Montagem certa!". |
| 4 | N-10 | Major | L6 guided, L8 pot version | Pot jumps in 7 steps; lesson says "sem degraus" and marks the honest answer "aos pulos" wrong; "arraste" but only tiny −/+ buttons. |
| 5 | N-07 / N-02 | Major | Prediction steps L2, L4, L5, L6 desafio, L7 | Wrong bets block progress ("Vamos testar!" but no Continuar); L2's "Antes de energizar" comes after energizing; missions reveal the result. |
| 6 | N-14 | Major | L10 step 13 | "10,6 mA no LED e no buzzer (cada ramo)" although the LED branch has 470 Ω (6,4 mA elsewhere). |
| 7 | S-02 (R1) | Major (partial) | L3 vs L4 | 6,25 (capsule) / 6,3 (status) / 6,4 (L4, formula) still differ, unexplained. |
| 8 | N-18 | Minor | Timed challenge | Time-out → Continuar works; timer tiny; message names teacher button "Testar de novo". |
| 9 | N-11 | Minor | L6 pot at 100 Ω | Warning says "sem resistor" although the pot is in the path; tray says "1 kΩ" for a 100 Ω–10 kΩ part. |
| 10 | N-13 | Minor | L8 (all) | No visual cue for loudness/pitch; "mais grave" taught as fact of the simulation. |
| 11 | N-12 | Minor | L8 desafio | Answer buttons describe the sounds ("mais fraco e mais grave"), no listening needed. |
| 12 | N-15 | Minor | L10 | "Ajuda mínima / tutor só fala depois de dois erros" not true; "ponto de retorno" undefined. |
| 13 | N-16 | Minor | L1 desafio | "Monte o circuito." with one battery: no real challenge. |
| 14 | N-17 | Minor | L1 step 5 | "Conferi o circuito inteiro…" when there is no circuit. |
| 15 | N-03 | Minor | L2 step 6/8 | Mission promises "circuito fechado ✓"; green praise bubble next to the ⚠ warning. |
| 16 | N-06 | Minor | Tray | "Jumper 3 colunas" covers 4 columns, "longo" covers 3, "4 colunas" covers 5. |
| 17 | N-05 | Note | L2 desafio | Ends with no "why" question. |
| 18 | N-08 | Note | L4 step 11 | "…e isso protege o LED" reads as "backwards is good". |
| 19 | N-09 | Note | Teacher debug panel | Duplicate React key console warning. |

Counts (new findings + still-open round-1 Majors): **Major 7** (S-04, S-02 partial, N-01, N-02/N-07, N-04, N-10, N-14),
**Minor 10**, **Note 3**. Round-1 Majors: FIXED S-01, S-06; FIXED for fault challenges S-03 (L1 desafio remainder =
N-16); PARTIAL S-02, S-05; NOT FIXED S-04; S-07 N/A (feature removed).

## 4. What works (observed in round 2)

* Real drag-and-drop from the tray works for every build step I tried: L2 guided (fully by hand, including fixing my own
  wrong jumpers), L4, L5, L5 desafio (two buttons in series), L6, L7, L8, L8 pot version and L10 (all 10 build steps).
* L2: the no-resistor warning is clear and honest ("limitada pela bancada", "Um LED sozinho, sem esse limite, poderia
  queimar"); L3 step 1 no longer contradicts L2.
* L4: the LED arrow and dark bar flip when rotated; reversed LED → "Sem corrente"; polarity explained afterwards.
* L5 / L5 desafio: Botão controls ("Botão A: solto/apertado") are a good non-drag alternative; series logic works
  (one pressed → "Sem corrente", both → 6,4 mA) and feedback explains why.
* L6 −/+ have clear aria-labels ("Diminuir/Aumentar resistência"); round-1 P-06 resolved (− = less resistance).
* L7: polarity warning now in step 5 ("a faixa marca o −… aqui a tela não simula esse defeito"); fade reported
  ("Última descarga: 1,7 s … (modelo simulado)"; 2000 µF → 3,3 s in the desafio).
* L9 guided: loose jumper visibly tilted with a "solto" tag; status "⚠ há uma peça mal encaixada" without ✓ (round-1 S-14
  fixed); short-circuit alarm "⚠ CURTO-CIRCUITO! … A bancada cortou a energia sozinha para proteger você (simulação)."
  clear and in red; removing the jumper restores 6,4 mA. L9 desafio (loose LED + short) solvable and approved.
* L10: the alarm works end to end with the button (LED + buzzer on, both stop on release).
* Column numbers 1–11 now drawn above and below the board (round-1 S-11 fixed). The help panel "Entenda a bancada e as
  telas" now explains V, Ω, µF and the E1–E6 slots (round-1 S-13/S-16 largely addressed).
* Honesty labels everywhere: "(simulado na tela)", "Valores simulados pelo software: não são medições da bancada
  física.", "Som simulado do buzzer (modelo didático, não é gravação nem medição)", "Os clipes são sons simulados…",
  "(modelo simulado)", "(simulação)" on the short alarm. I found no text claiming a measured value or a camera reading.
* Teacher library lists own lessons first, then the curriculum in order; 20 curriculum lessons, no colour-code lessons.

## 5. Not verified

* Sound (headless Chrome): could not judge the buzzer tones, the L8 clips or the tutor voice.
* Hint escalation on the bench for L2/L9 desafio (I checked the bench only for L4 desafio); whether any challenge has
  authored hints that I failed to trigger.
* Timed challenge on the bench screen (no timed lesson in the bench module); the timer for "Revisor R2 — desafio com
  tempo" (no 3 s) never appeared in the few seconds I watched.
* L3 guided build was done with "preencher com o gabarito" (all build steps), L6 desafio and L7 desafio are pre-built;
  L1/L3/L9/L4 desafio needed no or little building. All other build steps listed above were real drags.
* L5 desafio with a wrong (parallel) button wiring; reversed capacitor as a fault (the screen says it does not simulate
  it — I confirmed a rotated capacitor still shows "6,4 mA … circuito fechado ✓").
* Whether the N-04 parallel-jumper bug appears in other lessons (reproduced twice in L2 desafio only).
* Touch/tablet behaviour, small screens, colour-blind readability; bench ranking and camera screens.
* Unsaved-changes banner and duplicate-tag changes (teacher features, outside the student role).
