"""Helpers for driving the TedTronics lessons in headless Chrome (builds on cdp.py).

    import sys; sys.path.insert(0, "graph_validator/tools")
    from cdp import Browser
    from lab_driver import open_lesson, missions, click_piece, drag_from_tray, drag_piece_out
    with Browser("http://127.0.0.1:5180/") as b:
        open_lesson(b, "Lição 9 — Segurança: curto-circuito e mau contato (guiada)")
        b.click_text("Entendi, continuar"); b.click_text("Energizar", exact=True)

Gotchas learned the hard way:
  * the lesson test page also contains the Sandbox board (and a button "Energizar bancada") before the
    lesson's own board, so use exact=True for "Energizar"/"Desligar" and the helpers below, which pick the last match;
  * "preencher com o gabarito" (teacher preview only) fills the current step's answer, then "Continuar".
"""
import json
import time


def open_lesson(b, title):
    for _ in range(40):
        if b.eval("!!document.querySelector('#login-email')"): break
        time.sleep(0.25)
    b.fill("#login-email", "professor@tedtronics.local"); b.fill("#login-password", "tedtronics")
    b.click_text("Entrar", wait=2); b.wait_for("Suas lições")
    cards = b.eval("[...document.querySelectorAll('article')].map(a => a.innerText.split('\\n').find(l => l.startsWith('Lição')))")
    b.eval(f"[...document.querySelectorAll('article')][{cards.index(title)}].querySelectorAll('button')[1].click()")
    time.sleep(1.5)

def click_piece(b, title_part):
    """Click (pointerdown + window pointerup, no move) on a board piece whose title contains the text."""
    b.eval(f"""(() => {{ const e = [...document.querySelectorAll('div[title]')].find(d => d.title.includes({title_part!r}));
      e.dispatchEvent(new PointerEvent('pointerdown', {{bubbles: true, clientX: 10, clientY: 10}}));
      window.dispatchEvent(new PointerEvent('pointerup', {{clientX: 10, clientY: 10}})); }})()""")
    time.sleep(0.4)

def missions(b):
    return [l for l in b.text().split("\n") if l.startswith(("✅", "⬜"))]

def drag_from_tray(b, label, hole_title):
    """Drag a tray item (aria-label) to the first hole whose title starts with hole_title."""
    pos = b.eval(f"""(() => {{ const t = [...document.querySelectorAll({json.dumps(f'[aria-label="{label}"]')})].at(-1).getBoundingClientRect();
      const h = [...document.querySelectorAll('div[title]')].filter(d => d.title.startsWith({hole_title!r})).at(-6).getBoundingClientRect();
      return [t.x + 10, t.y + 10, h.x + h.width / 2, h.y + h.height / 2]; }})()""")
    x1, y1, x2, y2 = pos
    b.eval(f"""(() => {{ const t = [...document.querySelectorAll({json.dumps(f'[aria-label="{label}"]')})].at(-1);
      t.dispatchEvent(new PointerEvent('pointerdown', {{bubbles: true, clientX: {x1}, clientY: {y1}}}));
      window.dispatchEvent(new PointerEvent('pointermove', {{clientX: {x2}, clientY: {y2}}}));
      window.dispatchEvent(new PointerEvent('pointerup', {{clientX: {x2}, clientY: {y2}}})); }})()""")
    time.sleep(0.5)

def drag_piece_out(b, title_part):
    b.eval(f"""(() => {{ const e = [...document.querySelectorAll('div[title]')].filter(d => d.title.includes({title_part!r})).at(-1);
      e.dispatchEvent(new PointerEvent('pointerdown', {{bubbles: true, clientX: 10, clientY: 10}}));
      window.dispatchEvent(new PointerEvent('pointermove', {{clientX: -400, clientY: -400}}));
      window.dispatchEvent(new PointerEvent('pointerup', {{clientX: -400, clientY: -400}})); }})()""")
    time.sleep(0.5)
