"""Checks synthesized clip labels and quiz consistency, not audible sound quality."""
import sys
import time
from pathlib import Path
sys.path.insert(0, 'graph_validator/tools')
from cdp import Browser
results = []
for swapped in (False, True):
    with Browser('http://127.0.0.1:5187/') as b:
        b.send('Page.addScriptToEvaluateOnNewDocument', source='Math.random = () => ' + ('0.1' if swapped else '0.9'))
        b.goto('http://127.0.0.1:5187/tests/round2-browser.html?lesson=curriculo-08-desafio')
        assert b.wait_for('▶ Clipe A')
        b.click_text('▶ Clipe A', exact=True)
        time.sleep(1.5)
        b.click_text('▶ Clipe B', exact=True)
        time.sleep(1.5)
        assert 'volume simulado:' in b.text() and 'Hz' in b.text(), b.text()
        assert b.click_text('Continuar', exact=True), b.text()
        assert b.click_text('Clipe B' if swapped else 'Clipe A', exact=True), b.text()
        assert b.click_text('Continuar', exact=True), b.text()
        assert 'Como você percebeu' in b.text(), b.text()
        assert not b.errors, b.errors
        results.append('Clips swapped=' + str(swapped) + ': visual cues present, correct answer follows randomized order, explanation question follows.')
Path('AI/round2-audio-results.log').write_text('\n'.join(results) + '\n')
print('\n'.join(results))
