"""Every phrase the tutor can say: per lesson (what the teacher wrote) and the shared system pack."""
from __future__ import annotations

from typing import Any

from ..catalog import CATALOG, TYPES, normalize_type
from ..feedback import DEFAULT_MESSAGES, NAMES, fill, misconnected_message
from ..models import Piece

# Mirrors teacher_authoring_app/src/model/steps.ts (NOME, stepText, connectionStep) for lessons
# saved without steps, whose step texts the player generates on the fly.
_NOME = {
    "bateria": "a bateria", "led": "o LED", "buzzer": "o buzzer",
    "resistor_220": "o resistor de 220 Ω", "resistor_470": "o resistor de 470 Ω", "resistor_1k": "o resistor de 1 kΩ",
    "capacitor": "o capacitor", "botao": "o botão", "potenciometro": "o potenciômetro",
    "capsula_pulso": "a cápsula de pulso", "capsula_voltimetro": "a cápsula voltímetro",
    "capsula_amperimetro": "a cápsula amperímetro", "capsula_porta": "a cápsula de porta lógica",
    "capsula_memoria": "a cápsula de memória",
}
CONNECT_TEXT = "Agora conecte os componentes conforme o circuito pedido. As ligações serão conferidas nesta etapa."

# Fixed lines of the player (teacher_authoring_app/src/player/LessonPlayer.tsx) and of steps.py.
PRAISE = ["Boa!", "Isso aí!", "Mandou bem!", "Perfeito!", "Show!", "Exato!"]
PLAYER_PHRASES = [
    *PRAISE,
    "Escolha uma alternativa.",
    "Não foi dessa vez. Tente de novo.",
    "Monte o circuito.",
    "O tempo acabou! Clique em Continuar para ver a explicação. Você pode refazer a lição depois.",
    "Hipótese anotada! Continue para testar e comparar com o resultado.",
    "Esta etapa está conferida. Observe a montagem e clique em Continuar.",
    "Funcionou na simulação, mas veja o aviso de limite de corrente antes de continuar.",
    "Lição concluída! É assim que o aluno vai passar por ela.",
    "Agora responda à pergunta.",
    "Quase! Observe de novo e tente outra vez.",
    "Missões cumpridas! Você viu o efeito acontecer. Continue quando quiser.",
    "Montagem certa! Tente energizar!",
    "Falta ligar alguma coisa. Siga com o dedo do + da bateria até o − e veja onde o caminho para.",
    "Confira as peças da bandeja: será que falta alguma na sua bancada?",
    "Confira as peças da bancada: será que tem alguma a mais do que o circuito pede?",
    "Alguma peça da bancada não é a que o circuito pede. Confira cada uma.",
    "A peça está certa, mas o valor não. Veja o valor escrito em cada peça da bandeja.",
    "Ainda não é isso. Siga o caminho da corrente com o dedo: ela sai do + da bateria, passa pelas peças e volta ao −.",
    "Siga do + da bateria até o LED e depois até o −. Procure onde falta um jumper para completar o caminho.",
    "Falta o jumper do + da bateria até o lado + (anodo) do LED: uma ponta na coluna do +, a outra na coluna do anodo. O lado − do LED já está na coluna do − da bateria.",
    "Compare os lados do LED com os polos da bateria. O LED só conduz em um sentido.",
    "Gire o LED: o lado da barra (catodo) deve ficar no caminho de volta ao − da bateria. Preserve a posição da bateria para comparar.",
    "Para o LED só acender com os DOIS botões apertados, a corrente tem de passar por um botão E depois pelo outro, um atrás do outro (em série).",
    "Monte a fila: + da bateria → resistor → LED → botão A → botão B → − da bateria, ligando cada peça à próxima com jumpers.",
    "São dois defeitos ao mesmo tempo. Comece pelo mais perigoso: procure um jumper que liga os dois lados da bateria direto. É ele que dispara o alarme de curto.",
    "Tire o jumper curto que liga as duas colunas da bateria. Depois, se uma peça estiver marcada como “solta”, clique nela para encaixá-la de verdade.",
]


def step_text(piece: dict[str, Any]) -> str:
    if piece["type"].startswith("jumper"):
        names = {"jumper_curto": "o jumper curto", "jumper_longo": "o jumper longo",
                 "jumper_3": "o jumper super longo", "jumper_4": "o jumper super hiper longo",
                 "jumper_5": "o jumper de 5 colunas"}
        return (f"Coloque {names.get(piece['type'], 'um jumper')} na bancada. "
                "Confira se ele liga as colunas pedidas no circuito.")
    return f"Coloque {_NOME.get(piece['type'], 'a peça')} na bancada."


def _family(ptype: str) -> str:
    d = CATALOG.get(normalize_type(ptype))
    return d.family if d else "*"


def _overrides(overrides: dict[str, dict[str, str]], families: set[str]) -> list[str]:
    """Teacher feedback templates, filled with every name they can be spoken with."""
    out = []
    for per_family in (overrides or {}).values():
        for family, template in (per_family or {}).items():
            if not isinstance(template, str) or not template.strip():
                continue
            for f in sorted(families | {"*"}) if family == "*" else [family]:
                try:
                    out.append(fill(template, f))
                except (KeyError, IndexError, ValueError):
                    out.append(template)  # unknown placeholder: the validator would fail on it too
    return out


def lesson_phrases(doc: dict[str, Any]) -> list[str]:
    """What the tutor says in this lesson because of what the teacher wrote, in playing order."""
    pieces = (doc.get("board") or {}).get("pieces") or []
    families = {_family(p["type"]) for p in pieces if isinstance(p, dict) and "type" in p}
    out = [doc.get("title", ""), doc.get("instruction", "")]
    quizzes = doc.get("quizzes") or []

    def quiz_lines(q: dict[str, Any]) -> list[str]:
        lines = [q.get("prompt", "")]
        for o in q.get("options") or []:
            lines += [o.get("text", ""), o.get("feedback", "")]
        return lines

    for q in quizzes:
        if q.get("position") == "before":
            out += quiz_lines(q)
    steps = doc.get("steps") or []
    if doc.get("kind") == "guided" and not steps:
        out += [step_text(p) for p in pieces] + ([CONNECT_TEXT] if pieces else [])
    for s in steps:
        if s.get("action") == "explain":  # the player reads the heading, then one paragraph at a time
            out.append(s.get("title", ""))
            out += (s.get("text") or "").split("\n\n")
        else:
            out.append(s.get("text", ""))
        out += _overrides(s.get("overrides") or {}, families)
    for q in quizzes:
        if q.get("position") != "before":
            out += quiz_lines(q)
    seen: dict[str, None] = {}
    for text in out:
        if isinstance(text, str) and text.strip():
            seen.setdefault(text, None)
    return list(seen)


def system_phrases() -> list[str]:
    """Phrases every lesson can use: default feedback for each family, misconnected variants, player lines."""
    out = [fill(DEFAULT_MESSAGES[c], f) for c in DEFAULT_MESSAGES for f in NAMES]
    pieces = [Piece(id=t, type=t, a=1, b=2, row=0) for t in TYPES]
    for expected in pieces:
        out.append(misconnected_message(expected, None))
        out += [misconnected_message(expected, partner) for partner in pieces]
    out += PLAYER_PHRASES
    return list(dict.fromkeys(out))
