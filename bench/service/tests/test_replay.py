"""The replay source is offline, reproducible, and scores without guessing."""
from pathlib import Path
import json

import cv2 as cv
import numpy as np

from bench_service.replay import ReplayCamera, check_determinism, replay, score

FIXTURES = Path(__file__).resolve().parents[3] / 'visao/fixtures/current/bench-2026-11-11'


def test_replay_camera_uses_exact_saved_exposure_or_labels_synthesis():
    camera = ReplayCamera(FIXTURES, 1280, 720, seed=7, perturb=False)
    camera.set(cv.CAP_PROP_EXPOSURE, 1000)
    ok, image = camera.read()
    assert ok and image.shape == (720, 1280, 3)
    assert camera.read_log[-1]['picture'] == 'bands-a-exp1000.jpg'
    assert not camera.read_log[-1]['synthetic_exposure']
    camera.set(cv.CAP_PROP_EXPOSURE, 1050)
    camera.read()
    assert camera.read_log[-1]['source_exposure'] == 1000
    assert camera.read_log[-1]['synthetic_exposure']
    camera.set(cv.CAP_PROP_EXPOSURE, 1300)
    camera.read()
    assert camera.read_log[-1]['normal_exposure_assumed']
    assert camera.read_log[-1]['source_exposure'] is None


def test_perturbations_are_seeded_and_do_not_touch_originals():
    first = ReplayCamera(FIXTURES, 1280, 720, seed=17)
    second = ReplayCamera(FIXTURES, 1280, 720, seed=17)
    third = ReplayCamera(FIXTURES, 1280, 720, seed=18)
    assert np.array_equal(first.read()[1], second.read()[1])
    assert not np.array_equal(first.read()[1], third.read()[1])


def test_scorer_counts_wrong_resistors_and_unknowns_separately():
    expected = {'pieces': [
        {'type': 'resistor_220', 'row': 1, 'a': 1, 'b': 2},
        {'type': 'resistor_1k', 'row': 1, 'a': 4, 'b': 5},
        {'type': 'capacitor', 'row': 1, 'a': 8, 'b': 9, 'allow_unknown_body': True},
        {'type': 'capsula_smart', 'row': 4, 'a': 4, 'b': 6, 'allow_unknown_mode': True},
    ]}
    frame = {'valid': True, 'reason': '', 'pieces': [
        {'type': 'resistor_470', 'row': 1, 'a': 2, 'b': 3}], 'unknown': [
        {'type': 'peca_sem_tipo', 'row': 1, 'a': 5, 'b': 6},
        {'type': 'peca_sem_tipo', 'row': 1, 'a': 9, 'b': 10},
        {'type': 'capsula_smart', 'row': 4, 'a': 5, 'b': 7}]}
    report = score([frame], expected)
    assert report['wrong_values'] == 1
    assert report['unknown_resistor_values'] == 1
    assert report['unknown_bodies'] == 2
    assert [e['kind'] for e in report['frames'][0]['errors']] == ['wrong_value', 'unknown']
    assert report['longest_correct_streak'] == 0


def test_full_service_loop_replays_saved_images_without_opening_camera(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError('replay attempted to open a real camera')

    monkeypatch.setattr(cv, 'VideoCapture', forbidden)
    result = replay(FIXTURES, frames=3, width=1280, height=720, perturb=False)
    assert len(result['frames']) == 3
    assert all(frame['frame_size'] == [1280, 720] for frame in result['frames'])
    assert all('updated_at' in frame for frame in result['frames'])
    assert {read['requested_exposure'] for read in result['reads']} >= {1000, 1100, 1300}


def test_normal_saved_picture_publication_snapshot():
    expected = json.loads((FIXTURES / 'snapshot-normal.json').read_text())
    actual = replay(FIXTURES, frames=len(expected), width=1280, height=720, perturb=False)
    assert actual['frames'] == expected


def test_service_replay_does_not_use_stale_exposure_readback(monkeypatch):
    monkeypatch.setattr(ReplayCamera, 'get', lambda self, prop: 9999.0)
    expected = json.loads((FIXTURES / 'snapshot-normal.json').read_text())[:3]
    actual = replay(FIXTURES, frames=3, width=1280, height=720, perturb=False)
    assert actual['frames'] == expected
    assert {read['requested_exposure'] for read in actual['reads']} >= {1000, 1100, 1300}


import pytest


@pytest.mark.xfail(reason='target not met yet: startup and buzzer/resistor frames break the streak (25 of 50 on 2026-11-11)')
def test_saved_bench_pictures_reach_thirty_consecutive_correct_frames_without_wrong_values():
    expected = json.loads((FIXTURES / 'expected.json').read_text())
    result = replay(FIXTURES, frames=50, width=1280, height=720, perturb=True)
    report = score(result['frames'], expected)
    assert report['wrong_values'] == 0
    assert report['longest_correct_streak'] >= 30, report['longest_correct_streak']


def test_service_loop_does_not_consult_public_timeout_view(monkeypatch):
    from bench_service.vision import VisionSource

    def forbidden(_source):
        raise AssertionError('public timeout view must not drive frame processing')

    monkeypatch.setattr(VisionSource, 'state', forbidden)
    result = replay(FIXTURES, frames=3, width=1280, height=720, perturb=False)
    assert len(result['frames']) == 3
    assert all(frame['valid'] for frame in result['frames'])


def test_saved_picture_replay_is_byte_identical_across_processes():
    expected = json.loads((FIXTURES / 'expected.json').read_text())
    result = check_determinism(FIXTURES, expected, frames=1, warmup=0, perturb=True,
                               runs=20, subprocesses=2)
    assert result == {'identical': True, 'in_process_runs': 20, 'subprocess_runs': 2,
                      'different_in_process': [], 'different_subprocesses': []}
