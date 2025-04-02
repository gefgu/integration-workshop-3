import asyncio
from core import session

async def run_mode():
    print("[IdleMode] Entered Idle/Home Mode")
    session.select_melody(None)
    session.stop_playback()
    try:
        while session.state.page == "home":
            if session.state.accessibility:
                print("Turn on ESP32 Communication")  # TODO: esp32 logic
            session.stop_playback()
            await asyncio.sleep(1)

    except asyncio.CancelledError: # when ModeManager does .cancel()
        print("[IdleMode] Exited Idle Mode")
        raise
