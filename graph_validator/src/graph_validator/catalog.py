"""Component catalog, ported from teacher_authoring_app/src/engine/sim.js (DEFS, KIT_LIMITS, DIRECTED)."""
from __future__ import annotations

from dataclasses import dataclass

COLS = 11
BANK_ROWS = 6
ROWS = BANK_ROWS * 2
BANK_NODE = 100  # node id = col + BANK_NODE * bank: the two banks are separate nodes (PCB v0.4)


def bank(row: int) -> int:
    """0 = bank A (rows 0..5), 1 = bank B (rows 6..11)."""
    return 1 if row >= BANK_ROWS else 0


def node(col: int, row: int) -> int:
    """Electrical node of a socket: every column of a bank is one node; banks never touch."""
    return col + BANK_NODE * bank(row)


@dataclass(frozen=True)
class ComponentDef:
    family: str  # electrical family used for matching (resistor_* -> resistor, jumpers -> jumper)
    length: int  # column distance |b - a| between the two terminals
    terminals: tuple[str, ...]  # terminal names for legs `a`, `b` (and `c` for 3-pin capsules)
    value: int | None = None  # fixed value (ohms) when the type encodes one
    kit_limit: int = 0


_PIN = ("pin", "pin")
_CAPSULE = ("P1", "P2", "P3")

CATALOG: dict[str, ComponentDef] = {
    "bateria": ComponentDef("bateria", 1, ("+", "-"), kit_limit=1),
    "led": ComponentDef("led", 1, ("anode", "cathode"), kit_limit=2),
    "buzzer": ComponentDef("buzzer", 1, _PIN, kit_limit=1),
    "resistor_220": ComponentDef("resistor", 1, _PIN, value=220, kit_limit=1),
    "resistor_470": ComponentDef("resistor", 1, _PIN, value=470, kit_limit=1),
    "resistor_1k": ComponentDef("resistor", 1, _PIN, value=1000, kit_limit=1),
    "capacitor": ComponentDef("capacitor", 1, _PIN, kit_limit=2),
    "botao": ComponentDef("botao", 1, _PIN, kit_limit=2),
    "potenciometro": ComponentDef("potenciometro", 1, _PIN, kit_limit=1),
    "jumper_curto": ComponentDef("jumper", 1, _PIN, kit_limit=6),
    "jumper_longo": ComponentDef("jumper", 2, _PIN, kit_limit=3),
    "jumper_4": ComponentDef("jumper", 4, _PIN, kit_limit=3),
    "jumper_5": ComponentDef("jumper", 5, _PIN, kit_limit=3),
    # Passive smart capsules: three consecutive columns (P1, P2, P3); behaviour is in `config`.
    "capsula_pulso": ComponentDef("capsula_pulso", 2, _CAPSULE, kit_limit=3),
    "capsula_voltimetro": ComponentDef("capsula_voltimetro", 2, _CAPSULE, kit_limit=3),
    "capsula_amperimetro": ComponentDef("capsula_amperimetro", 2, _CAPSULE, kit_limit=1),
    "capsula_porta": ComponentDef("capsula_porta", 2, _CAPSULE, kit_limit=3),
    "capsula_memoria": ComponentDef("capsula_memoria", 2, _CAPSULE, kit_limit=3),
}

TYPES = tuple(CATALOG)
POT_VALUES = (100, 220, 470, 1000, 2200, 4700, 10000)
POT_DEFAULT = 1000
JUMPER_FAMILY = "jumper"
# Types whose a->b direction matters (polarity).
DIRECTED = frozenset({"bateria", "led"})

# Smart capsules (three pins, each with its own role) and how many may be on the board at once.
CAPSULES = frozenset(t for t in CATALOG if t.startswith("capsula_"))
MAX_CAPSULES = 3
# Types whose terminals are not interchangeable (polarity or pin roles).
ORDERED = DIRECTED | CAPSULES

# Smart-capsule slots on the connection board (PCB v0.4): P1/P2/P3 sit on columns 1-3, 5-7 and 9-11
# of the first row of bank A (row 0) and the last row of bank B (row 11). Numbered 1..6 like the PCB.
SLOT_COLS = (1, 5, 9)
SLOT_ROWS = (0, ROWS - 1)
AMMETER_SLOT = 2  # INA219 + shunt are wired to this position only: bank A, columns 5-7


def slot_of(col: int, row: int) -> int | None:
    """Slot number 1..6 for a capsule whose P1 is at (col, row), or None when it is not on a slot."""
    if col not in SLOT_COLS or row not in SLOT_ROWS:
        return None
    return SLOT_ROWS.index(row) * len(SLOT_COLS) + SLOT_COLS.index(col) + 1

GATE_OPS = ("and", "or", "nand", "nor", "xor", "not")
MEM_KINDS = ("d", "sr")
PULSE_HZ = (0.5, 10.0)
PULSE_DUTY = (25, 75)
CONFIG_DEFAULTS: dict[str, dict] = {
    "capsula_pulso": {"hz": 1.0, "duty": 50},
    "capsula_voltimetro": {},
    "capsula_amperimetro": {},
    "capsula_porta": {"op": "and"},
    "capsula_memoria": {"mem": "d"},
}


def config_problems(ctype: str, config: dict | None) -> list[str]:
    """Range/enum problems in a capsule's config (empty list = fine). Missing keys use defaults."""
    if ctype not in CAPSULES:
        return [] if not config else [f"{ctype} takes no config"]
    cfg = {**CONFIG_DEFAULTS[ctype], **(config or {})}
    extra = set(cfg) - set(CONFIG_DEFAULTS[ctype])
    out = [f"{ctype}: unknown config key {k}" for k in sorted(extra)]
    if ctype == "capsula_pulso":
        if not PULSE_HZ[0] <= cfg["hz"] <= PULSE_HZ[1]:
            out.append(f"hz must be within {PULSE_HZ[0]}..{PULSE_HZ[1]}")
        if not PULSE_DUTY[0] <= cfg["duty"] <= PULSE_DUTY[1]:
            out.append(f"duty must be within {PULSE_DUTY[0]}..{PULSE_DUTY[1]}")
    elif ctype == "capsula_porta" and cfg["op"] not in GATE_OPS:
        out.append(f"op must be one of {', '.join(GATE_OPS)}")
    elif ctype == "capsula_memoria" and cfg["mem"] not in MEM_KINDS:
        out.append(f"mem must be one of {', '.join(MEM_KINDS)}")
    return out


def config_key(ctype: str, config: dict | None) -> tuple:
    """Canonical, hashable form of a capsule's config (defaults filled in); () for other types."""
    if ctype not in CAPSULES:
        return ()
    return tuple(sorted({**CONFIG_DEFAULTS[ctype], **(config or {})}.items()))

# Legacy lesson files saved before resistor values existed.
LEGACY_TYPES = {"resistor": "resistor_470"}


def normalize_type(t: str) -> str:
    return LEGACY_TYPES.get(t, t)


def piece_value(ctype: str, value: int | None) -> int | None:
    """Value used for optional value matching: fixed for resistors, `value`/default for the pot."""
    d = CATALOG[ctype]
    if d.value is not None:
        return d.value
    if ctype == "potenciometro":
        return value if value is not None else POT_DEFAULT
    return None
