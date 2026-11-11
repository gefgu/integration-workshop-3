"""Prepare Piper audio for the standalone 1 kΩ camera-test lesson."""
import json
import subprocess
from pathlib import Path

from graph_validator.tts import PLAYER_PHRASES, audio_file, audio_dir, default_synth, ensure_audio, lesson_phrases, normalize

ROOT = Path(__file__).resolve().parents[2]
VOICE = ROOT / 'graph_validator' / 'voices' / 'pt_BR-cadu-medium.onnx'
MANIFEST = ROOT / 'bench' / 'raspberry-pi' / 'dist' / 'voice-files.json'


def main():
    if not VOICE.is_file() or not VOICE.with_suffix('.onnx.json').is_file():
        raise SystemExit('Piper voice missing: run graph_validator/tools/fetch_voice.sh first.')
    command = ['node', '--import', 'tsx', '--input-type=module', '-e',
               'import {curriculumLessons} from "./src/curriculum/lessons.ts"; console.log(JSON.stringify(curriculumLessons()))']
    lessons = json.loads(subprocess.check_output(command, cwd=ROOT / 'teacher_authoring_app', text=True))
    ids = {'curriculo-03-guiada-1k', 'curriculo-teste-voltimetro-buzzer'}
    selected = [item for item in lessons if item['id'] in ids]
    if len(selected) != len(ids):
        raise SystemExit('A test lesson is missing from the curriculum.')
    phrases = {normalize(text) for lesson in selected for text in lesson_phrases(lesson)}
    phrases.update(normalize(text) for text in PLAYER_PHRASES)
    missing = sorted(text for text in phrases if text and not (audio_dir() / audio_file(text)).is_file())
    print(f'Piper: {len(selected)} test lessons, {len(phrases)} phrases, {len(missing)} to synthesize', flush=True)
    synth = default_synth()
    for index, text in enumerate(missing, 1):
        ensure_audio([text], synth)
        if index % 25 == 0 or index == len(missing):
            print(f'Piper: {index}/{len(missing)}', flush=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(sorted(audio_file(text) for text in phrases if text)), encoding='utf-8')


if __name__ == '__main__':
    main()
