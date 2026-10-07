import os

# Saving a lesson synthesizes its audio; tests opt in with a fake voice (test_tts.py) instead of Piper.
os.environ.setdefault("TEDTRONICS_TTS", "off")
