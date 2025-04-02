import numpy as np
import sounddevice as sd
import asyncio

from .utils import *
from . import session 

# Sample rate for audio
sample_rate = 44100

# A duração das notas precisa ser menor que attack + decay + release
def envelope(t, attack=0.01, decay=0.1, sustain_level=0.7, release=0.2):
    total_samples = len(t)
    env = np.zeros_like(t)
    
    # Convert times to samples
    attack_samples = int(attack * sample_rate)
    decay_samples = int(decay * sample_rate)
    release_samples = int(release * sample_rate)
    
    # Adjust if sum of parts exceeds total
    total_env_samples = attack_samples + decay_samples + release_samples
    if total_env_samples > total_samples:
        # Scale down each phase proportionally
        scale = total_samples / total_env_samples
        attack_samples = int(attack_samples * scale)
        decay_samples = int(decay_samples * scale)
        release_samples = int(release_samples * scale)
    
    sustain_samples = total_samples - (attack_samples + decay_samples + release_samples)

    if attack_samples > 0:
        env[:attack_samples] = np.linspace(0, 1, attack_samples)
    if decay_samples > 0:
        start = attack_samples
        env[start:start + decay_samples] = np.linspace(1, sustain_level, decay_samples)
    if sustain_samples > 0:
        start = attack_samples + decay_samples
        env[start:start + sustain_samples] = sustain_level
    if release_samples > 0:
        env[-release_samples:] = np.linspace(sustain_level, 0, release_samples)

    return env


def synthesize_note(frequency, duration):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = (np.sin(2 * np.pi * frequency * t) +
            0.5 * np.sin(2 * np.pi * frequency * 2 * t) +
            0.25 * np.sin(2 * np.pi * frequency * 3 * t))
    volume_scale = session.state.volume / 100.0
    
    return wave * envelope(t) * volume_scale 

data_lock = asyncio.Lock()

async def play_note_async(note, duration):
    async with data_lock:

        freq = note_freqs.get(note)
        if freq is None:
            # Rest: just await sleep
            await asyncio.sleep(duration)
            return

        # Synthesize in thread to avoid blocking event loop
        wave = await asyncio.to_thread(synthesize_note, freq, duration)

        sd.stop()
        # Start playback
        sd.play(wave, samplerate=sample_rate)

# Example async caller
def run_sequence():
    async def main():
        # Play a scale
        for n in ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C']:
            await play_note_async(n, 0.3)

    asyncio.run(main())

if __name__ == '__main__':
    run_sequence()
