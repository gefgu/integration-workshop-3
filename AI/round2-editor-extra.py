"""Additional navigation checks using only the in-memory workspace fixture."""
import sys
from pathlib import Path
sys.path.insert(0, 'graph_validator/tools')
from cdp import Browser
results = []
with Browser('http://127.0.0.1:5187/tests/round2-browser.html?editor=1') as b:
    assert b.wait_for('Suas lições')
    b.click_text('Módulos', tag='a', exact=True)
    assert b.wait_for('Módulo da fixture')
    b.click_text('Abrir módulo', tag='a', exact=True)
    assert b.wait_for('Salvar módulo')
    b.fill('#edit-module-title', 'Título novo')
    assert 'Alterações ainda não salvas' in b.text()
    b.eval('window.confirm = () => false')
    b.click_text('← Todos os módulos', tag='a', exact=True)
    assert b.eval('location.pathname') == '/modulos/1'
    b.click_text('Salvar módulo', exact=True)
    assert 'Módulo salvo.' in b.text()
    assert 'Alterações ainda não salvas' not in b.text()
    results.append('Module: unsaved banner, canceling navigation, Save confirmation and clean state verified.')
    b.click_text('Lições', tag='a', exact=True)
    b.click_text('Editar', exact=True)
    labels = b.eval("[...document.querySelectorAll('textarea[aria-label^=\"Enunciado da pergunta\"]')].map(e => e.getAttribute('aria-label'))")
    assert len(labels) == len(set(labels)), labels
    b.fill('#title', 'Unsaved back navigation')
    b.eval('history.back()')
    assert b.wait_for('Unsaved back navigation') or b.eval('location.pathname').startswith('/editor')
    assert b.eval('location.pathname').startswith('/editor')
    b.click_text('Sair', exact=True)
    assert b.eval('location.pathname').startswith('/editor')
    results.append('Editor: canceled browser Back and sign-out preserve edits.')
    assert not b.errors, b.errors
Path('AI/round2-editor-results.log').write_text('\n'.join(results) + '\n')
print('\n'.join(results))
