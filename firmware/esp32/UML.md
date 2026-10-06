# Smart components firmware — UML

State machine and sequence diagrams for `smart_components/` (ESP32, 6 positions,
max 3 active). Mermaid renders on GitHub and in Notion (`/code` block → Mermaid).

Names in the diagrams match the code: `capsules::configure`, `outputs::apply`,
`sensing::readNode`, the `pulse` and `i2c` tasks, and so on.

---

## 1. State machine — system (boot, rail, watchdog)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> SafeBoot : power on / reset

    state SafeBoot {
        direction LR
        [*] --> OutputsDisabled
        OutputsDisabled --> PatternLoaded : shift 0xFF00 and latch
        PatternLoaded --> [*] : SR_OE_N = 0
    }
    note right of SafeBoot
        SR_OE_N is held high by its pull-up.
        U4 = 0x00 means DRV low and ammeter open.
        U5 = 0xFF means every P3 is high-Z.
    end note

    SafeBoot --> Running : tasks started, watchdog armed

    state Running {
        direction LR
        [*] --> RailOn
        RailOn --> RailOff : rail off / every P3 high-Z, AMM_EN = 0
        RailOff --> RailOn : rail on / re-apply each position's outputs
    }
    note right of Running
        Each position runs its own state machine (diagram 2).
        With the rail off, modes are kept but nothing is driven.
    end note

    Running --> WatchdogReset : a task stops feeding the watchdog for 3 s
    WatchdogReset --> SafeBoot : chip resets, SR_OE_N floats high
```

## 2. State machine — one position (p = 0…5)

```mermaid
stateDiagram-v2
    [*] --> Off

    Off --> Pulse : set p pulse hz duty [fewer than 3 active, 0.5–10 Hz, 25–75 %] / OE_N = 0, t0 = now
    Off --> Voltmeter : set p volt [fewer than 3 active]
    Off --> Ammeter : set 2 amm [p = 2, fewer than 3 active] / AMM_EN = 1
    Off --> Gate : set p gate op [fewer than 3 active] / OE_N = 0
    Off --> Memory : set p mem d or sr [fewer than 3 active] / OE_N = 0, Q = 0

    Pulse --> Off : set p off
    Voltmeter --> Off : set p off
    Ammeter --> Off : set 2 off / AMM_EN = 0
    Gate --> Off : set p off
    Memory --> Off : set p off
    AmmeterFault --> Off : set 2 off

    Ammeter --> AmmeterFault : current above 15 mA / AMM_EN = 0
    AmmeterFault --> Ammeter : set 2 amm / AMM_EN = 1

    state Pulse {
        [*] --> High
        High --> Low : 1 ms tick [phase ≥ duty × period] / DRV = 0
        Low --> High : 1 ms tick [new period] / DRV = 1
    }

    state Voltmeter {
        [*] --> Averaging
        Averaging --> Averaging : sensing round / add V(P1) − V(P2)
        Averaging --> Averaging : every 100 ms / publish average, redraw OLED
    }

    state Memory {
        state kind <<choice>>
        [*] --> kind
        kind --> Q0 : D or SR
        Q0 --> Q1 : D - P2 rises with P1 = 1, or SR - S = 1 and R = 0
        Q1 --> Q0 : D - P2 rises with P1 = 0, or SR - R = 1
    }

    note right of Gate
        Every sensing round (≤ 12 ms):
        P3 = op(P1, P2), with op one of
        AND, OR, NAND, NOR, XOR, NOT.
        Logic input: low ≤ 1.0 V, high ≥ 2.0 V.
    end note
    note left of Off
        P3 high-Z (OE_N = 1), DRV = 0.
        Any active state can also move directly to another
        mode with a new set command, without passing through Off.
        A set that would make 4 active is refused and the state is kept.
    end note
```

---

## 3. Sequence — boot

```mermaid
sequenceDiagram
    autonumber
    participant S as setup() core 1
    participant O as outputs (595 chain)
    participant M as sensing (4051 + ADC)
    participant C as capsules
    participant I as i2cbus
    participant P as pulse task core 0
    participant T as i2c task core 0

    S->>O: begin()
    Note over O: SR_OE_N = 1 (P3 high-Z)<br/>shift 0xFF00, latch<br/>SR_OE_N = 0
    S->>M: begin()
    Note over M: mux on Y6 (GND), ADC 12-bit, 11 dB
    S->>C: begin()
    C->>C: load gains from NVS
    C-)P: create task (priority 10)
    S->>I: begin()
    Note over I: pull-ups on SDA_0…5<br/>Wire on SDA_0, then route SDA
    I-)T: create task (priority 2)
    S->>S: watchdog 3 s (loop, pulse, i2c)
    loop every 500 ms
        T->>I: probeAll()
        I->>I: select(p), probe 0x3C
        alt OLED answers for the first time
            I->>I: initOled(p): init sequence + clear
        end
    end
```

## 4. Sequence — `set 1 volt` until the value is on the OLED

```mermaid
sequenceDiagram
    autonumber
    actor U as User / Raspberry Pi
    participant L as loop() core 1
    participant C as capsules
    participant O as outputs (595)
    participant M as sensing (4051 + ADC)
    participant T as i2c task core 0
    participant D as OLED at position 1

    U->>L: "set 1 volt\n"
    L->>C: configure(1, Volt)
    C->>C: check limits (max 3 active, position 0…5)
    C->>C: lock: mode = Volt, version++, cfgPending
    C->>O: apply(DRV1 | OE_N1, OE_N1)
    Note over O: P3 of position 1 stays high-Z<br/>(shift only if the image changed)
    C-->>L: ok
    L-->>U: "OK position 1 -> volt (outputs applied in N us)"

    loop every sensing round (about 3.3 ms per position)
        L->>C: senseRound()
        opt every 250 ms
            C->>M: select(Y6 = GND), settle 2 ms, readNode(32)
            M-->>C: divider offset (auto-zero)
        end
        C->>M: select(Y0 = position 1), settle 2 ms
        C->>M: readNode(16)
        M-->>C: mV at IO34 (P1) and IO35 (P2)
        C->>C: add V(P1) − V(P2) to the 100 ms average
        opt every 100 ms (SFR10)
            C->>C: publish vdiff, version++
        end
    end

    loop every ~5 ms
        T->>C: view(1)
        alt version changed and ≥ 200 ms since last frame
            T->>T: compose text (pt-BR), draw into RAM
            T->>T: select(1): route I2C SDA to IO21
            alt only the value changed
                T->>D: updateDisplayArea, pages 2–5 (~14 ms)
            else title or footer changed
                T->>D: sendBuffer, 8 pages (~29 ms)
            end
            T->>C: frameShown(1, version)
            C-->>T: time since the set command
            T-->>U: "[cfg] position 1: command -> first OLED frame in X ms"
        end
    end
```

## 5. Sequence — pulse and gate sharing the 595 chain

The pulse task (core 0) and the sensing loop (core 1) both write the same
16-bit shift-register image. A spinlock makes each update atomic.

```mermaid
sequenceDiagram
    autonumber
    participant P as pulse task core 0
    participant L as loop() core 1
    participant C as capsules
    participant O as outputs (595 + spinlock)
    participant H as 74HCT125 to P3

    par every 1 ms
        P->>C: lock, compute phase of each pulse position
        C-->>P: mask and value of the DRV bits
        P->>O: apply(mask, value)
        O->>O: enter critical section
        O->>O: image = (image & ~mask) | value
        O->>H: shift 16 bits + latch (~5 µs)
        O->>O: exit critical section
    and every sensing round
        L->>C: senseRound(): read P1, P2 of the gate position
        C->>C: hysteresis, out = op(P1, P2)
        C->>O: apply(DRV of that position, out)
        O->>O: wait for the spinlock if the pulse task holds it
        O->>H: shift 16 bits + latch
    end
```

## 6. Sequence — ammeter over-current

```mermaid
sequenceDiagram
    autonumber
    participant T as i2c task core 0
    participant A as INA219 (SDA_2)
    participant C as capsules
    participant O as outputs (595)
    participant K as AQW212 (PhotoMOS)
    participant D as OLED at position 2

    loop every 100 ms while position 2 is Ammeter
        T->>T: select(2): route SDA to IO19
        T->>A: read shunt register (0x01)
        A-->>T: raw, 10 µV per bit (1 µA on 10 Ω)
        T->>C: ammeterSample(mA, ok)
        alt current above 15 mA
            C->>C: fault = true, version++
            C->>O: apply(AMM_EN, 0)
            O->>K: LED off, switch opens
            Note over K: the circuit sees an open<br/>circuit between P1 and P2
            T->>D: "Amperímetro / ABERTO / Sobrecorrente!"
        else normal
            T->>D: "+3,21 mA" (value only)
        end
    end
    Note over C: Ammeter stays in AmmeterFault until<br/>"set 2 amm" or "set 2 off"
```

---

PNG exports (1600 px wide) are in `uml/`. To regenerate after editing this file,
render each Mermaid block with `mmdc` (`@mermaid-js/mermaid-cli`).
