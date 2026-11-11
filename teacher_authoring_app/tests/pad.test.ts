import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePadKey, nudgeValue, SELECTED, SLIDER_PRESSES } from '../src/bench/pad.ts';

test('a joystick press moves a slider one notch, clamped to its ends', () => {
  assert.equal(nudgeValue(50, 0, 100, 1), 60);
  assert.equal(nudgeValue(50, 0, 100, -1), 40);
  assert.equal(nudgeValue(95, 0, 100, 1), 100);
  assert.equal(nudgeValue(3, 0, 100, -1), 0);
  let v = 0;
  for (let i = 0; i < SLIDER_PRESSES; i++) v = nudgeValue(v, 0, 100, 1);
  assert.equal(v, 100);
});

/** Just enough DOM for pad.ts: one selected element inside a stage, plus "next"/"back" buttons that record clicks. */
function stage(selected: Record<string, unknown>) {
  const clicks: string[] = [];
  const button = (role: string) => ({ dataset: { pad: role }, offsetParent: {}, click: () => clicks.push(role) });
  const buttons = [button('next'), button('back')];
  const root = {
    // inside a lesson: ←/→ are the steps
    querySelector: (sel: string) => (sel === `.${SELECTED}` ? selected : sel === '.bench-lesson' ? {} : null),
    querySelectorAll: (sel: string) => {
      const role = /data-pad="([^"]+)"/.exec(sel)?.[1];
      if (role === 'item') return [selected];
      return buttons.filter((b) => b.dataset.pad === role);
    },
  };
  return { root: root as unknown as ParentNode, clicks };
}

function slider(value: number) {
  const events: string[] = [];
  return {
    el: {
      tagName: 'INPUT',
      type: 'range',
      min: '0',
      max: '100',
      value: String(value),
      dataset: { pad: 'item' },
      offsetParent: {},
      classList: { contains: () => true },
      dispatchEvent: (e: Event) => events.push(e.type),
    },
    events,
  };
}

test('with the resistance bar selected, ← / → adjust it instead of changing step', () => {
  const { el, events } = slider(50);
  const { root, clicks } = stage(el);
  assert.equal(handlePadKey('ArrowRight', root, () => undefined), true);
  assert.equal(el.value, '60');
  assert.equal(handlePadKey('ArrowLeft', root, () => undefined), true);
  assert.equal(handlePadKey('ArrowLeft', root, () => undefined), true);
  assert.equal(el.value, '40');
  assert.deepEqual(clicks, [], 'no step was skipped');
  assert.ok(events.includes('input'), 'React hears the change');
});

test('with a normal choice selected, → is still the next step', () => {
  const choice = { tagName: 'BUTTON', dataset: { pad: 'item' }, offsetParent: {}, click: () => undefined };
  const { root, clicks } = stage(choice);
  handlePadKey('ArrowRight', root, () => undefined);
  assert.deepEqual(clicks, ['next']);
});

test('joystick click energizes a lab screen without a selected choice', () => {
  const powerButton = { dataset: { pad: 'energize' }, offsetParent: {} };
  const root = {
    querySelector: () => null,
    querySelectorAll: (selector: string) => selector.includes('data-pad="energize"') ? [powerButton] : [],
  } as unknown as ParentNode;
  let presses = 0;
  assert.equal(handlePadKey(' ', root, () => { presses++; }), true);
  assert.equal(presses, 1);
});
