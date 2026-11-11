"""Exercise the updater in a temporary installation with fake system commands."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class UpdateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.prefix = self.root / 'installed'
        self.bundle = self.root / 'bundle'
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for base in (self.prefix, self.bundle):
            for name in ('graph_validator', 'bench_service'):
                path = base / 'app' / name / 'pyproject.toml'
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('same dependencies')
            (base / 'app' / 'visao').mkdir(parents=True)
            (base / 'app' / 'visao' / 'pipeline_atual.py').write_text('new' if base == self.bundle else 'old')
            (base / 'ui').mkdir()
            (base / 'ui' / 'bench.html').write_text('new' if base == self.bundle else 'old')
        (self.prefix / 'venv/bin').mkdir(parents=True)
        (self.prefix / 'venv/bin/python').symlink_to('/bin/true')
        (self.bundle / 'tedtronics-tela').write_text('#!/bin/sh\n')
        (self.root / 'local-bin').mkdir()
        script = (Path(__file__).parent / 'files/update.sh').read_text()
        script = script.replace('PREFIX=/opt/tedtronics-bancada', f'PREFIX={self.prefix}')
        script = script.replace('DROPIN_DIR=/etc/systemd/system/$SERVICE.d', f'DROPIN_DIR={self.root}/systemd/$SERVICE.d')
        script = script.replace('/usr/local/bin/tedtronics-tela', str(self.root / 'local-bin/tedtronics-tela'))
        script = script.replace('[ "$(id -u)" -ne 0 ]', '[ 0 -ne 0 ]')
        (self.bundle / 'update.sh').write_text(script)
        for name, body in {'systemctl': 'exit 0', 'curl': 'exit "${FAKE_CURL_EXIT:-0}"', 'sleep': 'exit 0'}.items():
            path = self.bin / name
            path.write_text(f'#!/bin/sh\n{body}\n')
            path.chmod(0o755)

    def run_update(self, **env):
        return subprocess.run(['bash', str(self.bundle / 'update.sh')], capture_output=True, text=True,
                              env={**os.environ, 'PATH': f'{self.bin}:{os.environ["PATH"]}', **env})

    def test_success_keeps_environment_and_uses_new_sources(self):
        result = self.run_update()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.prefix / 'ui/bench.html').read_text(), 'new')
        self.assertTrue((self.prefix / 'venv/bin/python').exists())
        dropin = self.root / 'systemd/tedtronics-bancada.service.d/tedtronics-source.conf'
        self.assertIn(f'{self.prefix}/app/graph_validator/src', dropin.read_text())

    def test_failure_rolls_back(self):
        result = self.run_update(FAKE_CURL_EXIT='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.prefix / 'ui/bench.html').read_text(), 'old')
        self.assertEqual((self.prefix / 'app/visao/pipeline_atual.py').read_text(), 'old')

    def test_dependency_change_leaves_existing_installation_alone(self):
        (self.bundle / 'app/graph_validator/pyproject.toml').write_text('changed')
        result = self.run_update()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.prefix / 'ui/bench.html').read_text(), 'old')


if __name__ == '__main__':
    unittest.main()
