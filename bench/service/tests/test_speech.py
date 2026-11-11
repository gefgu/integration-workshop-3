from unittest.mock import patch
from fastapi.testclient import TestClient

from bench_service.server import create_app
from bench_service.store import BenchStore


def test_local_voice_serves_arbitrary_lesson_text(tmp_path):
    client = TestClient(create_app(BenchStore(tmp_path / 'bench.sqlite3')))
    audio = tmp_path / 'speech.mp3'
    audio.write_bytes(b'ID3-test-audio')
    with patch('bench_service.server.synthesize_speech', return_value=audio) as run:
        result = client.get('/tts/speak', params={'text': 'Resistor de 1 kΩ e LED'})
    assert result.status_code == 200
    assert result.headers['content-type'] == 'audio/mpeg'
    assert result.content == b'ID3-test-audio'
    run.assert_called_once_with('Resistor de 1 kΩ e LED')


def test_local_voice_reports_missing_engine(tmp_path):
    client = TestClient(create_app(BenchStore(tmp_path / 'bench.sqlite3')))
    with patch('bench_service.server.synthesize_speech', side_effect=FileNotFoundError):
        result = client.get('/tts/speak', params={'text': 'Olá'})
    assert result.status_code == 503
    assert client.get('/tts/speak', params={'text': ' ' * 4}).status_code == 422
