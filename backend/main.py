import asyncio
import uvicorn
import importlib
import threading
from core import session, hardware
from core.detectionThread import NoteDetection
from api import manager
from core.globals import note_detect_obj


# Mapping between page values and their corresponding mode modules
MODE_MODULES = {
    "home": "modes.idle",
    "creation": "modes.creation",
    "identify": "modes.identify",
    "hear": "modes.hear",
}

thread_main = threading.Thread(target=note_detect_obj.detect_note_loop)

class ModeManager:
    def __init__(self):
        self.current_page = None
        self.mode_task = None

    async def monitor_state(self):
        while True:
            if session.state.page != self.current_page:
                print(f"[ModeManager] Page changed to: {session.state.page!r}")
                self.current_page = session.state.page

                # cancel any existing mode task
                if self.mode_task and not self.mode_task.done():
                    self.mode_task.cancel()
                    try:
                        await self.mode_task
                    except asyncio.CancelledError:
                        print("[ModeManager] Previous mode task cancelled.")

                module_path = MODE_MODULES.get(self.current_page)
                if module_path:
                    module = importlib.import_module(module_path)
                    if hasattr(module, "run_mode"):
                        print(f"[ModeManager] Starting mode: {module_path}")
                        self.mode_task = asyncio.create_task(module.run_mode())
                    else:
                        print(f"[ModeManager] Module '{module_path}' has no run_mode()")
                else:
                    print(f"[ModeManager] Unknown mode: {self.current_page!r}")

            await asyncio.sleep(0.5)

async def main():
    config = uvicorn.Config(
        "api:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        loop="asyncio",
    )
    server = uvicorn.Server(config)
    api_task = asyncio.create_task(server.serve())

    loop = asyncio.get_running_loop()
    hardware.set_main_loop_and_manager(loop, manager)

    thread_main.start()

    print("[Main] Uvicorn server and thread started")

    mode_manager_instance = ModeManager()
    try:
        await mode_manager_instance.monitor_state()
    finally:
        await server.shutdown()
        api_task.cancel()
        print("[Main] Uvicorn server stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        note_detect_obj.stop_note_detection_thread()
        thread_main.join()    
        if hardware.main_event_loop: # Check if GPIO was set up
            hardware.cleanup_gpio()
        print("\n[Main] Shutdown requested via Ctrl+C. Exiting cleanly.")

