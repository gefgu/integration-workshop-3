"""SFR12/SFR14/SFR15/SFR15.1: classify the assembly state and word the guidance (pt-BR, SNFR13)."""
from __future__ import annotations

from .diff import Issue
from .models import Category

# Order issues are reported in: the first one drives the main message.
PRIORITY = [
    Category.REVERSED_POLARITY,
    Category.WRONG_VALUE,
    Category.WRONG_COMPONENT,
    Category.INCORRECT_CONNECTION,
    Category.MISSING_COMPONENT,
    Category.MISSING_CONNECTION,
    Category.EXCESS_CONNECTION,
]

NAMES = {
    "bateria": "a bateria", "led": "o LED", "buzzer": "o buzzer", "resistor": "o resistor",
    "capacitor": "o capacitor", "botao": "o botão", "potenciometro": "o potenciômetro",
    "jumper": "o jumper", "*": "a peça",
}

# SFR15: every category has a default message. Short on purpose (SNFR5: at most 2 lines).
DEFAULT_MESSAGES: dict[Category, str] = {
    Category.COMPLETE: "Muito bem! Este passo está certo.",
    Category.MISSING_COMPONENT: "Falta uma peça. Pegue {nome} na bandeja e coloque na bancada.",
    Category.MISSING_CONNECTION: "Falta um fio. Siga o caminho da bateria com o dedo e veja onde ele para.",
    Category.EXCESS_CONNECTION: "Tem uma peça sobrando. Tire {nome} e veja se o circuito fica certo.",
    Category.INCORRECT_CONNECTION: "Tem uma ligação no lugar errado. Confira onde cada perninha está encaixada.",
    Category.REVERSED_POLARITY: "{nome_cap} só funciona em um sentido. Gire a peça e tente de novo.",
    Category.WRONG_VALUE: "Essa peça é a certa, mas o valor está diferente. Troque por outra da bandeja.",
    Category.WRONG_COMPONENT: "Essa não é a peça deste passo. Troque {nome} pela peça pedida.",
}

Overrides = dict[str, dict[str, str]]


def classify(issues: list[Issue]) -> Category:
    if not issues:
        return Category.COMPLETE
    return min((i.category for i in issues), key=PRIORITY.index)


def message_for(category: Category, family: str = "*", overrides: Overrides | None = None) -> str:
    """Teacher override per component family, then a category-wide override, then the default (SFR15.1)."""
    per = (overrides or {}).get(category.value, {})
    text = per.get(family) or per.get("*") or DEFAULT_MESSAGES[category]
    nome = NAMES.get(family, NAMES["*"])
    return text.format(nome=nome, nome_cap=nome[0].upper() + nome[1:])


def feedback(issues: list[Issue], overrides: Overrides | None = None) -> tuple[Category, str]:
    cat = classify(issues)
    first = next((i for i in issues if i.category == cat), None)
    return cat, message_for(cat, first.family if first else "*", overrides)
