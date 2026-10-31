"""Run with graph_validator/.venv/bin/python AI/round2-browser.py. No shared DB access."""
import sys
import time
from pathlib import Path
sys.path.insert(0, 'graph_validator/tools')
from cdp import Browser

base = 'http://127.0.0.1:5187/tests/round2-browser.html'
results = []
with Browser(base) as b:
    assert b.wait_for('A corrente anda em círculo'), b.text()
    b.click_text('Entendi, continuar')
    # Fill each placement and the circuit check. No Energizar needed before prediction.
    for _ in range(5):
        b.click_text('preencher com o gabarito')
        assert b.wait_for('Continuar'), b.text()
        assert b.click_text('Continuar', exact=True), b.text()
    assert 'Antes de energizar' in b.text(), b.text()
    assert b.click_text('Ele só pisca.', exact=True)
    assert 'Hipótese anotada' in b.text(), b.text()
    assert b.click_text('Continuar', exact=True), b.text()
    assert 'Você previu: “Ele só pisca.”' in b.text(), b.text()
    b.click_text('Energizar', exact=True)
    assert 'limite da simulação' in b.text(), b.text()
    results.append('L2: first power-on follows prediction; wrong hypothesis continues and stays visible in experiment.')
    assert not b.errors, b.errors
with Browser(base + '?lesson=curriculo-04-guiada') as b:
    assert b.wait_for('Será que o LED tem um lado certo?')
    b.click_text('Entendi, continuar')
    for _ in range(6):
        b.click_text('preencher com o gabarito')
        time.sleep(.5)
        assert b.click_text('Continuar', exact=True), b.text()
    assert b.click_text('Acende mais forte.', exact=True), b.text()
    assert b.click_text('Continuar', exact=True), b.text()
    assert 'Você previu' in b.text()
    assert 'Gire o LED, energize de novo e compare' in b.text()
    results.append('L4: wrong prediction continues; mission does not reveal the reversed-LED result.')
    assert not b.errors, b.errors
with Browser(base + '?editor=1') as b:
    assert b.wait_for('Suas lições'), b.text()
    assert b.click_text('Editar', exact=True)
    b.fill('#title', 'Título ainda não salvo')
    b.eval('window.confirm = () => false')
    b.click_text('Lições', tag='a', exact=True)
    assert b.eval('location.pathname').startswith('/editor'), b.text()
    assert b.eval("document.querySelector('#title').value") == 'Título ainda não salvo'
    b.eval('window.confirm = () => true')
    b.click_text('Lições', tag='a', exact=True)
    assert b.wait_for('Suas lições')
    assert b.eval('window.writes ?? 0') == 0
    results.append('Editor: canceled route navigation preserves unsaved edits; accepting leaves without saving.')
    assert not b.errors, b.errors

# Every workspace write below is intercepted by the fixture.
with Browser(base + '?editor=1') as b:
    assert b.wait_for('Suas lições')
    upload = """(() => {
      const lesson = structuredClone(window.fixtureLessons[0]); lesson.title = 'Imported replacement';
      const input = document.querySelector('input[type=file]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(lesson)], 'lesson.json', {type: 'application/json'}));
      input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true}));
    })()"""
    b.eval(upload)
    assert b.wait_for('Já existe uma lição com este id')
    assert b.eval('window.writes ?? 0') == 0
    assert b.eval("document.querySelector('input[name=import-mode]').checked")
    b.click_text('Abrir no editor', exact=True)
    assert b.eval('location.pathname').split('/')[-1] != 'curriculo-01-guiada'
    assert b.eval('window.writes ?? 0') == 0
    assert b.eval("document.querySelector('#title').value") == 'Imported replacement (cópia)'
    b.eval('window.confirm = () => true')
    b.click_text('Lições', tag='a', exact=True)
    b.eval(upload)
    assert b.wait_for('Já existe uma lição com este id')
    b.eval("document.querySelectorAll('input[name=import-mode]')[1].click()")
    b.click_text('Abrir no editor', exact=True)
    assert b.eval('window.writes ?? 0') == 0
    assert b.eval('location.pathname').endswith('/curriculo-01-guiada')
    b.click_text('Salvar', exact=True)
    assert b.eval('window.writes ?? 0') == 1
    results.append('Import: collision defaults to a fresh copy; replacement writes only on explicit Save.')
    assert not b.errors, b.errors
for suffix in ['02-desafio', '04-desafio']:
    for bench in ['', '&bench=1']:
        with Browser(base + '?lesson=curriculo-' + suffix + bench) as b:
            assert b.wait_for('Energizar')
            time.sleep(.5)
            b.click_text('Energizar', exact=True)
            assert 'Ainda não é isso' in b.text(), b.text()
            b.click_text('Desligar', exact=True)
            b.click_text('Energizar', exact=True)
            assert 'Ainda não é isso' not in b.text(), b.text()
            b.click_text('Desligar', exact=True)
            b.click_text('Energizar', exact=True)
            text3 = b.text()
            b.click_text('Desligar', exact=True)
            b.click_text('Energizar', exact=True)
            assert b.text() != text3
            assert ('Confira os dois jumpers' if suffix.startswith('02') else 'Gire o LED:') in b.text(), b.text()
            results.append('Challenge ' + suffix + (' bench' if bench else ' preview') + ': first attempt withholds hint, then hints escalate through four attempts.')
            assert not b.errors, b.errors
with Browser(base + '?lesson=curriculo-06-guiada&rename=1') as b:
    assert b.wait_for('Um resistor que gira')
    b.click_text('Entendi, continuar')
    for _ in range(6):
        b.click_text('preencher com o gabarito')
        time.sleep(.5)
        assert b.click_text('Continuar', exact=True), b.text()
    assert b.eval("!!document.querySelector('input[type=range]')"), b.text()
    results.append('Potentiometer: slider is present when student piece IDs differ from answer-key IDs.')
with Browser(base + '?lesson=curriculo-02-desafio&timed=1&bench=1') as b:
    assert b.wait_for('O tempo acabou!')
    assert 'Testar de novo' not in b.text()
    assert b.click_text('Continuar', exact=True), b.text()
    results.append('Timed bench challenge: timeout offers Continue to the explanation/question.')
Path('AI/round2-browser-results.log').write_text('\n'.join(results) + '\n')
print('\n'.join(results))
