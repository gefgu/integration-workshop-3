"""Every choice in each required prediction must permit continuing to the experiment."""
import sys
from pathlib import Path
sys.path.insert(0, 'graph_validator/tools')
from cdp import Browser
results = []
with Browser('http://127.0.0.1:5187/') as b:
    for suffix in ['02-guiada', '04-guiada', '05-guiada', '07-guiada', '06-desafio']:
        url = 'http://127.0.0.1:5187/tests/round2-browser.html?lesson=curriculo-' + suffix + '&prediction=1'
        b.goto(url)
        assert b.wait_for('Escolha uma alternativa.'), b.text()
        options = b.eval("window.fixtureLessons.find(l => l.id === 'curriculo-" + suffix + "').quizzes.find(q => q.prediction).options.map(o => o.text)")
        for index, option in enumerate(options):
            if index:
                b.goto(url)
                assert b.wait_for('Escolha uma alternativa.')
            assert b.click_text(option, exact=True), b.text()
            assert 'Hipótese anotada!' in b.text(), b.text()
            assert b.click_text('Continuar', exact=True), b.text()
            assert 'Você previu:' in b.text(), b.text()
        results.append(suffix + ': all ' + str(len(options)) + ' hypotheses continue to the experiment.')
    assert not b.errors, b.errors
Path('AI/round2-predictions-results.log').write_text('\n'.join(results) + '\n')
print('\n'.join(results))
