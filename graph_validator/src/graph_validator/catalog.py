"""Component catalog, ported from teacher_authoring_app/src/engine/sim.js (DEFS, KIT_LIMITS, DIRECTED)."""
from __future__ import annotations

from dataclasses import dataclass

COLS = 11
BANK_ROWS = 6
ROWS = BANK_ROWS * 2


@dataclass(frozen=True)
class ComponentDef:
    family: str  # electrical family used for matching (resistor_* -> resistor, jumpers -> jumper)
    length: int  # column distance |b - a| between the two terminals
    terminals: tuple[str, str]  # terminal names for leg `a` and leg `b`
    value: int | None = None  # fixed value (ohms) when the type encodes one
    kit_limit: int = 0


_PIN = ("pin", "pin")

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
}

TYPES = tuple(CATALOG)
POT_VALUES = (100, 220, 470, 1000, 2200, 4700, 10000)
POT_DEFAULT = 1000
JUMPER_FAMILY = "jumper"
# Types whose a->b direction matters (polarity).
DIRECTED = frozenset({"bateria", "led"})

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
