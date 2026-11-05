# Software Project (100%)

The software is now complete across the three products — the teacher website, the teacher mobile app and the bench screen — working together with the bench service, the camera vision pipeline and the server. This section describes everything that changed for D5, with screenshots of the real screens.

## End-to-End Walkthrough

> 🎬 A single video follows a full session: the teacher app connects to the bench and sends a module, the student signs in with a tag and works through a lesson, a challenge and the ranking, and the teacher fetches the progress back.

🎬 arraste aqui: TedTronics - app do professor e bancada.mp4

Video 1 — Teacher app and bench, interleaved.

### What the video shows

- **Teacher app:** Home dashboard, modules, a class with each student's progress, and the four-step “take a lesson to the bench” flow.
- **Bench:** Locked until the app connects; the student signs in with a tag, takes Lesson 1 (reading, question, building, experiment), a challenge with a score, and the ranking.
- **Sync:** The teacher sends another module and fetches the students' progress from the bench.
- **Editing:** Idle waits were cut and long parts are shown at 1.25×–2× (marked on screen); the recordings had no sound.

---

## Teacher Website: UI/UX Redesign

> 🎨 The whole website was redesigned around icons, dialogs and compact layouts, in the project's palette (cream background, terracotta and olive accents, Caprasimo and Figtree fonts).

📷 arraste aqui: site-01-licoes.png

Figure 1 — Lessons library: cards show each lesson's circuit as a schematic.

📷 arraste aqui: site-05-modulos.png

Figure 2 — Modules: the TedTronics curriculum is ready in every teacher account.

📷 arraste aqui: site-06-turma.png

Figure 3 — Class page: basics in a small header, the student list first.

📷 arraste aqui: site-07-alunos.png

Figure 4 — Students: tag, performance, edit and delete as icon buttons.

📷 arraste aqui: site-08-painel.png

Figure 5 — Performance dashboard per class.

### What the screenshots show

- **Header:** TedTronics logo on the left, profile and logout icons on the right, and a help button (?) on every page.
- **Lesson cards:** Each card draws the lesson's circuit as a schematic instead of a protoboard picture; tags and teacher notes (“…” with “Ler tudo”) are evenly spaced; duplicate, export and delete are icon buttons with a hover tip.
- **One-line filters:** Tag filters fit on one line at any width; extra tags go into a themed “Mais etiquetas” menu.
- **Create in a dialog:** New lesson, module, class and student open in a dialog with only the basic fields; every create button is a “+”.
- **Delete is a trash icon:** Every delete or remove action, everywhere, is the same trash icon with a confirmation.
- **Tips that never get cut:** Hover tips are drawn in a floating layer, so a scrolling box never hides them.
- **Curriculum for every teacher:** The 20 curriculum lessons and their 5 modules are imported automatically on a teacher's first login, and the Modules page can add or update them.
- **Themed scrollbars:** Scrollbars match the palette.

| Role | Colour |
| --- | --- |
| Background | `#F5EAD8` |
| Surface | `#EBDDC5` |
| Text | `#201E1D` |
| Accent (terracotta) | `#C67139` |
| Accent 2 (olive) | `#7A8A5E` |

---

## Lesson Editor: Boxes with Tabs, No Page Scroll

> 🧩 The editor fits the screen: the tray, the protoboard and the lesson each sit in their own box with tabs, and only a box scrolls — never the page.

📷 arraste aqui: site-02-editor-protoboard.png

Figure 6 — Editor: tray, protoboard with lit tracks, and the lesson box.

📷 arraste aqui: site-04-editor-passos.png

Figure 7 — The lesson box on the Passos tab.

### What the screenshots show

- **Tabs in each box:** Tray (Componentes, Jumpers, Cápsulas), board (Protoboard, Esquema) and lesson (Lição, Passos, Perguntas).
- **Board fits its box:** The protoboard is scaled to the box's height, and dropping a piece still lands on the right hole.
- **Eraser on top:** Clearing the board is an eraser icon at the top of the board box.
- **Lit tracks:** On the virtual protoboard, the tracks that are connected light up with arrows along each column, so the teacher sees which holes share a node.
- **“Protoboard”, not “Tabuleiro”:** The board is called Protoboard everywhere.

---

## Schematic Mode for the Protoboard

> ✏️ The teacher can build a lesson's circuit as a drawing: place symbols and connect their terminals, and the protoboard layout is generated automatically. The Protoboard and Esquema tabs switch between the two views of the same circuit.

📷 arraste aqui: site-03-editor-esquema.png

Figure 8 — Esquema tab in the editor: symbols wired as a drawing.

📷 arraste aqui: site-10-sandbox-esquema.png

Figure 9 — The same mode in the sandbox.

### How it works

- **Draw:** A palette adds the kit's components as schematic symbols; clicking one terminal and then another draws a wire; symbols can be dragged to tidy the drawing.
- **Nets:** The wires are turned into electrical nets (groups of terminals that must be connected).
- **Automatic placement:** A search assigns each net to protoboard columns and places every component across the right columns; jumpers join a net that needs more than one column. Piece and jumper IDs are kept, so lesson steps stay linked to their pieces.
- **Both ways:** Switching back to Protoboard shows the generated layout, which can still be adjusted by hand; switching to Esquema rebuilds the drawing from the board.
- **Smart capsules:** Circuits with smart capsules show a read-only schematic, because their placement depends on the bench slots.
- **Tests:** The placement engine has its own unit tests (nets from wires, board to netlist, placement).

---

## Sandbox and Lesson Validator

> 🧪 The sandbox keeps the protoboard fixed on one half of the screen, and the lesson validator now shows a lesson exactly as the bench shows it, screen by screen.

📷 arraste aqui: site-09-sandbox.png

Figure 10 — Sandbox: protoboard on the left; Energizar, Validar and the parts on the right.

📷 arraste aqui: site-11-validador.png

Figure 11 — Lesson validator: the bench's 1024×600 screen inside a monitor frame, with a screen carousel.

### What the screenshots show

- **Half and half:** The protoboard (or the drawing) stays still on the left; the right half holds the controls and the parts and scrolls on its own.
- **Energizar stands out:** A large terracotta power button with a soft pulse.
- **Validator = bench preview:** The bench's own screens, scaled to fit, with the same CSS and fitting logic as the real 7" monitor.
- **Carousel:** Dots and arrows jump to any screen of the lesson, so a teacher can check one step without replaying the lesson.
- **Teacher controls outside the screen:** Back to the editor, Sandbox/Validator switch and validation debug sit in a bar above the monitor frame.

---

## Bench Screens (7", 1024×600)

> 🖥️ Every bench screen was redesigned for the 7" LCD read at arm's length: one screen at a time, no scrolling, less text, larger controls, and long content split into more screens.

📷 arraste aqui: bancada-01-bloqueada.png

Figure 12 — Locked until the teacher's app connects.

📷 arraste aqui: bancada-02-tag.png

Figure 13 — Tag screen: the student taps the NFC tag to sign in.

📷 arraste aqui: bancada-03-inicio-aluno.png

Figure 14 — Student home: continue where you stopped, lessons six per page.

### What the screenshots show

- **Locked:** One message (“ask your teacher to connect the app”) and the bench name.
- **Tag:** A pulsing tag icon, the module name and large Ranking and Camera buttons; unknown tags get a clear message, and typing “Tag 3” or “3” both work.
- **Student home:** A greeting, a large “Continue” card for the next lesson, and the lessons as numbered tiles, six per page with arrows (a module can have 20 lessons).
- **No scrolling:** A fit stage scales a screen down only when it would not fit the monitor, so nothing is ever cut or scrolled.

### Lesson Screens

📷 arraste aqui: bancada-04-abertura-licao.png

Figure 15 — Opening screen of a lesson.

📷 arraste aqui: bancada-05-leitura.png

Figure 16 — Reading: two short paragraphs per screen, next to the drawing.

📷 arraste aqui: bancada-06-pergunta.png

Figure 17 — Question: big options; the tutor answers after the choice.

📷 arraste aqui: bancada-09-experimento.png

Figure 18 — Experiment briefing: what to do and the missions, before the lab.

### What the screenshots show

- **Slim top bar:** Back, the lesson title, one dot per step, the camera status and the voice on/off button — instead of three rows of title, step, back and voice.
- **Opening screen:** Each lesson starts with its title and the tutor saying what it is about.
- **Paged readings:** Long readings become several screens of at most two short paragraphs; the node explorer gets a screen of its own.
- **Questions:** Large question and answers; the hamster tutor only speaks after an answer, with the feedback.
- **Experiments:** A briefing screen lists the missions first; the lab screen then keeps a compact checklist.

---

## Building on the Real Board: Camera, Tray and Physical Controls

> 📷 The student builds on the physical protoboard. The camera vision pipeline reads the board and the screen's protoboard mirrors it; the student uses only the bench's joystick and its physical Energizar button.

📷 arraste aqui: bancada-08-montagem-certa.png

Figure 19 — Building step: tutor on the top left, the tray below, the board mirrored on the right.

📷 arraste aqui: bancada-12-licao4.png

Figure 20 — Lesson 4: only the part of this step is active in the tray.

📷 arraste aqui: bancada-07-tour-montagem.png

Figure 21 — First build screen with the guided tutorial.

### What the screenshots show

- **Layout:** The tutor's speech fills the top of the left half, the tray sits below it, and the protoboard keeps the right half.
- **Board follows the camera:** With the camera on, the screen board is read-only and mirrors the real board; a chip in the top bar says whether the camera is reading the board or paused (hand in front, scene moving). Without a camera the board falls back to on-screen dragging (demo).
- **Tray shows the step's parts:** The parts the current step asks for are highlighted; every other part is greyed out (“Pegue na bandeja”).
- **Physical controls:** The joystick moves the focus between controls and OK presses the focused one; Back leaves the screen; the physical Energizar button powers the circuit. The screen shows the power state instead of an on-screen button.
- **Contract with the Raspberry Pi:** Each physical control arrives as a key (arrows, Enter, Escape, “e”), documented in the bench protocol, so the input bridge on the Pi only maps buttons to keys.

### Score and Ranking

📷 arraste aqui: bancada-10-pontuacao.png

Figure 22 — Score at the end of a challenge.

📷 arraste aqui: bancada-11-ranking.png

Figure 23 — Ranking: the best scores of the challenge.

### What the screenshots show

- **Score:** A large score with the time, and a short message from the tutor.
- **Ranking:** The top three of the challenge, by score and then time.

---

## Teacher Mobile App

> 📱 The teacher app was reorganised around bottom tabs, a dashboard home and a guided flow to take a lesson to the bench.

📷 arraste aqui: app-01-inicio.png

Figure 24 — Home dashboard.

📷 arraste aqui: app-03-modulos.png

Figure 25 — Modules tab.

📷 arraste aqui: app-04-turma.png

Figure 26 — Class: students with tag, progress and best score.

📷 arraste aqui: app-05-conectar.png

Figure 27 — Take a lesson to the bench, step 1: connect.

📷 arraste aqui: app-06-modulo.png

Figure 28 — Step 3: choose the module.

📷 arraste aqui: app-07-confira-e-envie.png

Figure 29 — Step 4: review and send.

📷 arraste aqui: app-08-sincronizado.png

Figure 30 — Bench tab after fetching the progress.

### What the screenshots show

- **Tabs:** Início, Turmas, Módulos and Bancada, with icons; the Bancada tab shows a dot while a bench is connected.
- **Home dashboard:** The main action (“Levar aula à bancada”), the bench card (connected or not, module loaded) and the progress card (records waiting on the bench and on the phone, last upload, one button to fetch and send).
- **Guided send flow:** Four numbered steps — Bench → Class → Module → Send — with a review screen and a success screen; modules assigned to the class are listed first.
- **Class progress:** Students per class with their tag, lessons done, best score, time on the bench and last activity, like the website's dashboard.
- **Connect a bench:** Bluetooth for the real bench or the simulator over Wi-Fi; the last simulator address is remembered.
- **Browser version:** The app also runs in a browser (an optimized build served on the local network), used for demos without installing the APK.

---

## Guided Tutorials (First Visit and Help Button)

> ❓ The website, the bench and the teacher app each have a guided tutorial that highlights one control at a time and explains it. It opens on the first visit, can be skipped, and comes back from the ? button.

📷 arraste aqui: site-12-tour.png

Figure 31 — Website tutorial highlighting the menu.

📷 arraste aqui: app-02-tour.png

Figure 32 — Teacher app tutorial on the home screen.

### What the screenshots show

- **Spotlight and card:** The page is dimmed, the control is highlighted, and a card explains it with Pular / Voltar / Próximo and the step count.
- **Per page:** One tour per website page (Lessons, Modules, Classes, Class, Students, Dashboard, Editor, Sandbox, Validator), per bench screen (tag, student home, first build screen) and per app screen.
- **Bench with the joystick:** On the bench the tour is driven with the joystick (arrows and OK); Back skips it.
- **Help:** The ? button opens the tour of the current screen again.

---

## Bench Service, Server and Deployment

> ⚙️ Behind the screens, the bench service and the server gained the pieces the complete system needs.

- **Camera integration:** The bench service runs the vision pipeline (camera or a looped photo) and exposes the live board, the annotated frame and a recalibrate action; the lesson screen polls it about three times per second.
- **Teacher switch:** When a different teacher connects to a bench, the previous teacher's module and student list are dropped, so another class's tags stop working; progress already recorded is kept for its teacher.
- **Tags typed by hand:** “Tag 3”, “TAG 3” and “ 3 ” are accepted as the code “3”.
- **Demo mode:** With the service in development mode, the bench can load a curriculum module with three demo students and be tested without the phone; demo progress is never sent to the server.
- **Phone progress:** A database migration gives the phone read access to its own students' progress, used by the class screen.
- **Ready to publish:** One service serves the website and the API together (with a Docker image and a deployment guide); for now the demo runs locally.

### Tests

- **Website and bench screens:** 100 tests.
- **Server (graph validator and API):** 91 tests.
- **Bench service:** 14 tests, including the vision mapping and a real photo of the board.
- **Teacher app:** 21 tests.
