/**
 * The bench is played like a game console: a joystick (arrows), its click (Enter) and a long press (Escape).
 * Screens do not list their controls here; they tag them with `data-pad`:
 *
 *   data-pad="item"       a choice (modules, students, lessons, quiz options): ↑/↓ move the selection;
 *                         a selected slider (`<input type="range">`) takes ←/→ to change its value
 *   data-pad="next"       Próximo / Continuar / Começar: →
 *   data-pad="back"       Voltar inside the screen (previous page, leave this screen): ←
 *   data-pad="step-back"  the lesson's previous step, used by ← when the screen has no "back" of its own
 *   data-pad="energize"   marks a board that can be powered: the click energizes it
 *
 * The selection is a class drawn by the screen (`pad-selected`), not the browser focus: a kiosk window may not
 * have focus, and the tag field keeps it for the NFC reader.
 * Click (Enter): presses the selected choice; on a lab screen it energizes; elsewhere it presses "next".
 * Long press (Escape) opens the game menu (sound, help, ranking, camera, leave).
 * A screen that needs its own keys listens in the capture phase and calls preventDefault().
 */

export const SELECTED = 'pad-selected';

const usable = (el: HTMLElement) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled;

export function padElements(root: ParentNode, role: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-pad="${role}"]`)].filter(usable);
}

export function selectedItem(root: ParentNode): HTMLElement | null {
  const el = root.querySelector<HTMLElement>(`.${SELECTED}`);
  return el && el.dataset.pad === 'item' && usable(el) ? el : null;
}

export function selectElement(root: ParentNode, el: HTMLElement | null | undefined): void {
  for (const old of root.querySelectorAll(`.${SELECTED}`)) if (old !== el) old.classList.remove(SELECTED);
  if (!el) return;
  el.classList.add(SELECTED);
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** On a lab screen the click energizes: nothing is preselected there, so the click is never stolen. */
const labScreen = (root: ParentNode) => padElements(root, 'energize').length > 0;

/** Every screen with choices shows one selected (the `data-pad-default` one, else the first). */
export function ensureSelection(root: ParentNode): void {
  if (selectedItem(root) || labScreen(root)) return;
  const items = padElements(root, 'item');
  if (items.length) selectElement(root, items.find((el) => el.dataset.padDefault !== undefined) ?? items[0]);
}

/** Moves the selection among the visible choices; returns the newly selected one. */
export function moveSelection(root: ParentNode, delta: 1 | -1): HTMLElement | null {
  const items = padElements(root, 'item');
  if (!items.length) return null;
  const at = items.indexOf(selectedItem(root) as HTMLElement);
  const preferred = items.find((el) => el.dataset.padDefault !== undefined) ?? items[0];
  const next = at < 0 ? preferred : items[Math.min(items.length - 1, Math.max(0, at + delta))];
  selectElement(root, next);
  return next;
}

/** Presses the control with this role (the innermost screen wins: it is last in the DOM). */
export function pressRole(root: ParentNode, ...roles: string[]): boolean {
  for (const role of roles) {
    const found = padElements(root, role);
    const target = found[found.length - 1];
    if (target) {
      target.click();
      return true;
    }
  }
  return false;
}

/** Joystick presses from one end of a slider to the other (the potentiometer bar: 0..100 in 10 presses). */
export const SLIDER_PRESSES = 10;

/** The value a slider takes after one joystick press (dir -1 = ←, +1 = →), clamped to its range. */
export function nudgeValue(value: number, min: number, max: number, dir: 1 | -1, presses = SLIDER_PRESSES): number {
  const step = (max - min) / presses;
  return Math.min(max, Math.max(min, Math.round((value + dir * step) * 1000) / 1000));
}

const isSlider = (el: HTMLElement | null): el is HTMLInputElement =>
  !!el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range';

/**
 * Moves a selected `<input type="range">` one notch. React only sees a change through the native value setter
 * plus an `input` event (setting `.value` directly is swallowed by its value tracker).
 */
function nudgeSlider(el: HTMLInputElement, dir: 1 | -1): true {
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const next = nudgeValue(Number(el.value), min, max, dir);
  const setValue =
    typeof HTMLInputElement === 'undefined'
      ? undefined
      : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setValue) setValue.call(el, String(next));
  else el.value = String(next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

const hasChoices = (root: ParentNode) => padElements(root, 'item').length > 0;
/** A screen of choices outside a lesson (inside one, ←/→ are always the steps). */
const listScreen = (root: ParentNode) => hasChoices(root) && !root.querySelector('.bench-lesson');

/**
 * The game-pad meaning of a key on the bench stage; true when it was handled.
 *   →  Próximo (or the next choice, on a screen with no Próximo)    ←  Voltar (or the previous choice)
 *   ↑  the next choice (or Próximo, on a screen with no choices)   ↓  the previous choice (or Voltar)
 *   Space (joystick click)  confirms the selected choice
 *   Enter (Energizar: the PC keyboard for now, a dedicated button later)  energizes on lab screens
 */
export function handlePadKey(key: string, root: ParentNode, energize: () => void): boolean {
  const selected = selectedItem(root);
  // A selected slider (the potentiometer's resistance bar) takes ← / →: less / more, instead of changing step.
  if (isSlider(selected) && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    return nudgeSlider(selected, key === 'ArrowRight' ? 1 : -1);
  }
  switch (key) {
    case 'ArrowUp':
      return hasChoices(root) ? moveSelection(root, 1) !== null : pressRole(root, 'next');
    case 'ArrowDown':
      return hasChoices(root) ? moveSelection(root, -1) !== null : pressRole(root, 'back', 'step-back');
    // In a list (outside a lesson) ←/→ walk through the choices; ← on the first one is Voltar.
    case 'ArrowLeft':
      if (listScreen(root)) {
        const items = padElements(root, 'item');
        if (items.indexOf(selected as HTMLElement) > 0) return moveSelection(root, -1) !== null;
        return pressRole(root, 'back', 'step-back') || moveSelection(root, -1) !== null;
      }
      return pressRole(root, 'back', 'step-back') || moveSelection(root, -1) !== null;
    case 'ArrowRight':
      if (listScreen(root)) return moveSelection(root, 1) !== null || pressRole(root, 'next');
      return pressRole(root, 'next') || moveSelection(root, 1) !== null;
    case ' ':
      if (selected) {
        selected.click();
        return true;
      }
      // Inside a lesson only ← / → / Energizar move things: the click is for the quiz's choices.
      return labScreen(root) || root.querySelector('.bench-lesson') ? false : pressRole(root, 'next');
    case 'Enter':
      if (labScreen(root)) {
        energize();
        return true;
      }
      if (selected) {
        selected.click();
        return true;
      }
      return pressRole(root, 'next');
    default:
      return false;
  }
}
