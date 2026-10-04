# Ajustes no Gantt para os Risk Response Plans

Analisei a sequência atual do Gantt. Para os **R04, R05, R08 e R18**, eu não colocaria os Planos B apenas no final do projeto. Eles precisam aparecer logo depois da atividade que consegue detectar o problema, para evitar que vocês avancem várias etapas com uma arquitetura que depois terá de ser refeita.

Também faria uma pequena mudança na tarefa de compra: o R08 já prevê uma segunda ESP32 como contingência, e o R18 prevê contatos de alto ciclo, como pogo pins, e guias mecânicas.

### 1. Primeiro, altere uma atividade que já existe no Deliverable 1

Atualmente vocês têm:

> **Order the electronics: CH446Q ICs, controllers, 12 V supply, buck converters, eFuse, PTC fuse, sockets and contacts**

Eu mudaria para:

> **Order the electronics: CH446Q ICs, controllers, backup ESP32, 12 V supply, backup 5 V supply, LM2596 and XL4015 buck converters, eFuse, PTC fuse, sockets, pogo pins and contacts**

Isso é importante porque **Plano B não adianta se vocês só comprarem a peça depois que o risco acontecer**.

Eu manteria:

- **Deliverable:** 1
- **Category:** ELECTRONIC
- **Owner:** João
- **Data:** 29/09
- **Optional:** No

---

# R04 — Insufficient Power Supply

Aqui falta uma atividade que realmente teste se os 12 V são suficientes.

## Adicionar antes de `Implement power-bus sensing...`

### Atividade obrigatória

> **Validate the complete power architecture under worst-case load conditions**

**Descrição curta:**  
Measure total and peak current consumption and verify the 12 V supply voltage stability under representative maximum-load conditions.

**Onde colocar:** depois de:

> `Design the 12 V/2 A DC input, reverse-polarity protection, and buck conversion to logic level`

e depois de:

> `Design the regulated 5 V educational supply`

mas **antes de**:

> `Implement power-bus sensing and independent hardware overcurrent/short-circuit cutoff`

Eu colocaria por volta de **04–05/10**.

- **Category:** ELECTRONIC
- **Estimated Time:** 2 h
- **Optional:** No
- **Owner:** João
- **Supervisor:** Gustavo

### Plano B — atividade opcional

> **Integrate an independent regulated 5 V supply for digital loads**

**Descrição:**  
Add an independent 5 V supply for the Raspberry Pi, controllers, and digital peripherals if the 12 V supply cannot support the complete system reliably.

- **Blocked by:** `Validate the complete power architecture...`
- **Estimated Time:** 2 h
- **Optional:** Yes
- **Discart if someone withdraw:** No

Essa é a atividade do **Plano B do R04**.

---

# R05 — 5 V DC-DC Conversion Stage

O mesmo teste acima consegue detectar parte do R05, mas eu especificaria que ele deve medir:

- output voltage;
- ripple;
- temperature;
- load regulation;
- transient response.

Assim não precisamos criar dois testes quase iguais.

### Plano B — atividade opcional

Logo depois de:

> `Validate the complete power architecture under worst-case load conditions`

adicione:

> **Replace the LM2596 with the XL4015 backup converter and revalidate the 5 V rail**

**Descrição:**  
Replace the LM2596 stage with the backup XL4015 converter if voltage regulation, ripple, temperature, or current capability does not meet the project requirements, and repeat the power validation.

- **Deliverable:** 3
- **Category:** ELECTRONIC
- **Estimated Time:** 2 h
- **Optional:** Yes
- **Owner:** João
- **Supervisor:** Gustavo

Fluxo:

```text
Design 12 V / 5 V power architecture
            ↓
Validate power architecture
       ↙             ↘
     PASS             FAIL
       ↓               ↓
continue          identify cause
                  ↙          ↘
              R04            R05
               ↓              ↓
        second 5 V PSU     XL4015
```

Esse arranjo fica muito bom no Gantt porque **um único teste dispara dois Planos B diferentes dependendo do problema encontrado**.

---

# R08 — Insufficient Controller Capacity

No Gantt atual, vocês constroem as três smart capsules e depois começam o firmware delas.

É exatamente entre essas duas etapas que eu colocaria o teste do R08.

Atualmente:

```text
Build the 3 smart capsules
       ↓
Implement smart capsule base firmware
```

Eu mudaria para:

```text
Build the 3 smart capsules
       ↓
Controller stress test
       ↓
 [R08 Plan B if needed]
       ↓
Smart capsule base firmware
```

### Atividade obrigatória

> **Run controller resource and concurrency stress testing**

**Descrição:**  
Test processor load, GPIO usage, memory, communication buses, and concurrent operation of the switching matrix, smart capsules, NFC, and physical controls.

**Onde:** depois de:

> `Build the 3 smart capsules: microcontroller, OLED...`

e antes de:

> `Implement smart capsule base firmware...`

Eu colocaria em **18–19/10**, considerando que o build das cápsulas termina em 17/10.

- **Deliverable:** 4
- **Category:** ELECTRONIC
- **Estimated Time:** 2 h
- **Optional:** No
- **Owner:** João/Gustavo

### Plano B

> **Integrate a second ESP32 and distribute controller workloads**

**Descrição:**  
Add a second ESP32 and move smart-capsule communication and related processing to the additional controller.

- **Estimated Time:** 3 h
- **Optional:** Yes
- **Blocked by:** `Run controller resource and concurrency stress testing`
- Deve ser executada **antes do smart capsule base firmware continuar**, caso o teste falhe.

Isso corresponde diretamente à mitigação já definida no R08.

---

# R18 — Intermittent Electrical Contacts

Aqui encontrei o ponto do Gantt que eu mais mudaria.

Vocês já têm:

> **Run socket durability testing: repeated insertion/removal cycles**

Isso é **perfeito como atividade que dispara o risco R18**.

O problema é que hoje vocês têm:

> `Manufacture the complete physical component kit`

**antes** do teste de durabilidade.

Eu evitaria isso.

Vocês podem fabricar algumas cápsulas para protótipo, mas eu **não fecharia o sistema de contato definitivo antes do teste de durabilidade**.

### Sugestão

Trocar:

> **Manufacture the complete physical component kit**

por algo como:

> **Manufacture the prototype physical component kit for integration and durability testing**

Então:

```text
Prototype capsules
       ↓
Socket durability test
       ↓
    PASS / FAIL
           ↓
       R18 Plan B
```

### Plano B do R18

Adicionar depois de:

> `Run socket durability testing: repeated insertion/removal cycles`

a atividade:

> **Redesign the capsule contact interface using pogo pins and mechanical alignment guides**

**Descrição:**  
Replace unreliable conventional contacts with pogo pins and add mechanical guides to ensure correct capsule alignment during insertion.

- **Category:** MECHANICAL / ELECTRONIC
- **Estimated Time:** 3 h
- **Optional:** Yes
- **Owner:** Mechanical team + João
- **Blocked by:** `Run socket durability testing`

E logo depois:

> **Repeat contact durability and continuity testing after the pogo-pin redesign**

- **Estimated Time:** 1.5–2 h
- **Optional:** Yes
- **Blocked by:** pogo-pin redesign

Isso implementa exatamente a prevenção do R18, que prevê contatos de alto número de ciclos e guias de alinhamento.

---

## Então eu adicionaria estas 7 atividades

| Risk | Activity | Type |
| --- | --- | --- |
| R04/R05 | **Validate the complete power architecture under worst-case load conditions** | Mandatory |
| R04 | **Integrate an independent regulated 5 V supply for digital loads** | Plan B |
| R05 | **Replace the LM2596 with the XL4015 backup converter and revalidate the 5 V rail** | Plan B |
| R08 | **Run controller resource and concurrency stress testing** | Mandatory |
| R08 | **Integrate a second ESP32 and distribute controller workloads** | Plan B |
| R18 | **Redesign the capsule contact interface using pogo pins and mechanical alignment guides** | Plan B |
| R18 | **Repeat contact durability and continuity testing after the pogo-pin redesign** | Plan B validation |

### Como eu marcaria os Planos B no Gantt

Os quatro Planos B devem ficar com:

**Optional = Yes**

mas eu colocaria:

**Discart if someone withdraw = No**

porque eles não são funcionalidades extras que podem simplesmente ser removidas. São **tarefas condicionais de contingência**: só serão executadas se o risco ocorrer, mas, se ocorrer, tornam-se necessárias para o projeto funcionar.

A mudança mais importante na ordem seria esta:

```text
POWER
Design
  ↓
Power validation
  ├── PASS → Power-bus implementation
  └── FAIL
        ├── R04 → independent 5 V PSU
        └── R05 → XL4015
                  ↓
              revalidate
                  ↓
          Power-bus implementation


CONTROLLER
Build smart capsules
       ↓
Controller stress test
       ├── PASS
       │
       └── FAIL → Second ESP32
                       ↓
              Smart capsule firmware


CONTACTS
Prototype capsules
       ↓
Durability test
       ├── PASS
       │
       └── FAIL → Pogo-pin redesign
                       ↓
                  durability retest
                       ↓
                Finalize hardware
```

Dessa forma os **Risk Response Plans deixam de ser apenas documentos** e passam a estar efetivamente representados no cronograma.
