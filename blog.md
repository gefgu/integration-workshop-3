# Blog - Team #2

## Links 🔗

- [Project Review](./TedThunder.md) 🔍
- [Requirements](./docs/REQUIREMENTS.md) ✔️
- [Guided Modules and Challenges](./docs/modules_plan/modules.md) 📚
- [Risk Analysis](./docs/ProjectRisks.md) 💣
- [Budget](./docs/Budget.md) 💵
- [Schedule]() 📅

> [!NOTE]
> The more you scroll, older the posts will be.

---

## 4th Week (10/09/26)

**Class:** live reply about the enhanced plans A and B. Bonus: talk with the expert (#1).

As requested, this post describes the enhanced versions of the two plans carried over from last
week. After today's rebuttal, the team picks **one** of them to develop for the rest of the
semester.

For Plan A, we vibe-coded a web prototype using a Claude design. With this prototype, we asked a teenager(9th grade) to interact, and based on this interaction and feedback,  we focused mostly on the educational aspect of the project and the best ways to achieve it.

![The test prototype of a guided module: the component tray on the left, the node matrix in the middle with the 9 V battery and the LED already placed, the Energizar button below it, and the tutor panel on the right asking for the resistor to be placed in series](./docs/images/guided_module_prototype.png)

*The test prototype — Module 01, "Acender um LED", at step 4 of 8: the tutor explains that without
the resistor almost 400 mA would go through the LED and burn it.*

### Plan A — TedThunder ⚡

An interactive electronics workbench for Fundamental II students (7th to 8th grade). The student
builds a real circuit out of Lego-like component capsules on a connection table, presses
**Energizar**, and watches it actually work while a guided tutor walks them through each step.

What we detailed this week:

- **Detection.** A camera on a fixed boom reads a QR code on each capsule, with color as a
  fallback, and derives the circuit graph from which sockets each capsule occupies.
- **Validation.** Every step of a module is a target graph; a step is approved when the assembled
  graph contains it by subgraph isomorphism. The difference between the two becomes the tutor's
  hint.
- **Energization.** Safe circuits are really powered through a crosspoint switch matrix — the LED
  really lights. Hazardous ones are never energized; the consequence is played on screen instead.
- **Electronics.** Merged the electronics team's requirements and risk analysis: 5 V rails,
  11 programmable nodes, crosspoint switching, and a passive hardware current limiter.
- **Content.** Ten guided modules plus challenge versions, and a bonus module on the resistor
  color code.

📄 [Full project description](./TedThunder.md) · 📋 [Requirements](./docs/REQUIREMENTS.md) ·
📚 [Modules](./docs/modules_plan/modules.md) · 💣 [Risks](./docs/ProjectRisks.md) (Very early stage) ·
💵 [Budget](./docs/Budget.md) (Very early stage)

### Plan B — "Kendo Tutor" - Not developed

---

## 3rd Week (03/09/26 - 09/09/26)

**Class:** live reply about the project proposals, plus a short talk on *Functional and
Non-functional Requirements*.

The team presented a more detailed version of the proposals discussed the week before. After the
professors' rebuttal we narrowed the field to two ideas to enhance for this week.

Following the requirements talk, we started writing the project's requirements properly — splitting
them into functional, non-functional and anti-requirements, and grouping them by area rather than
keeping one flat list.

**Proposals presented:** 

- **A.** **"Smart workbench for electronics education"**
- **B.** "Kendo Tutor"

---

## 2nd Week (27/08/26 - 02/09/26)

**Class:** first round of preliminary project proposals, plus a short talk on *Time Management
Strategies*.

The team presented three project proposals, named plans A, B and C. After the professors' rebuttal
we were asked to keep two of the three and bring them back with more detail and specification.

- **A.** "Essay Exam Grader"
- **B.** "Distance detector for oranges"
- **C.** **"Smart workbench for electronics education"**

---

## 1st Week (20/08/26 - 26/08/26)

**Class:** overall introduction and course overview, a short talk about the PMBOK method with
examples of successful projects, and a short presentation about the features required in the
projects.

Teams of up to five students were formed by semi-random draw from predefined sub-teams. Team #2:

- Gabriel Martines
- Gustavo Henrique Bruno dos Santos (Project Manager)
- João Vitor Bezerra
- Julia Mariano
- Tainara Novaes
