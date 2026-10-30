"""A tiny headless-Chrome driver (Chrome DevTools Protocol) for exercising the web app without an extension.

    from cdp import Browser
    with Browser("http://127.0.0.1:5180/") as b:
        b.fill("#login-email", "professor@tedtronics.local"); b.click_text("Entrar")
        b.screenshot("/path/out.png"); print(b.text()); print(b.errors)

Standard library plus `websockets`. The Chrome profile lives in graph_validator/.cdp-profile (git-ignored).
"""
import json
import shutil
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

from websockets.sync.client import connect

PROFILE_ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Browser:
    def __init__(self, url: str, width: int = 1280, height: int = 1500, port: int | None = None) -> None:
        # One port and one profile per instance, so several reviewers can drive Chrome at the same time.
        port = port or free_port()
        self.profile = PROFILE_ROOT / f".cdp-profile-{port}"
        shutil.rmtree(self.profile, ignore_errors=True)
        self.proc = subprocess.Popen(
            ["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", f"--remote-debugging-port={port}",
             f"--user-data-dir={self.profile}", f"--window-size={width},{height}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            try:
                targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
                page = next(t for t in targets if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("Chrome did not start")
        self.ws = connect(page["webSocketDebuggerUrl"], max_size=None)
        self.n = 0
        self.errors: list[str] = []
        self.logs: list[str] = []
        self.send("Runtime.enable")
        self.send("Page.enable")
        self.send("Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=1, mobile=False)
        self.goto(url)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def close(self) -> None:
        try:
            self.ws.close()
        finally:
            self.proc.terminate()
            shutil.rmtree(self.profile, ignore_errors=True)

    def send(self, method: str, **params):
        self.n += 1
        mid = self.n
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            self._note(msg)
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})

    def _note(self, msg: dict) -> None:
        if msg.get("method") == "Runtime.exceptionThrown":
            d = msg["params"]["exceptionDetails"]
            self.errors.append(d.get("exception", {}).get("description") or d.get("text", "exception"))
        elif msg.get("method") == "Runtime.consoleAPICalled":
            text = " ".join(str(a.get("value", a.get("description", ""))) for a in msg["params"]["args"])
            (self.errors if msg["params"]["type"] == "error" else self.logs).append(text)

    def goto(self, url: str, wait: float = 1.5) -> None:
        self.send("Page.navigate", url=url)
        time.sleep(wait)

    def eval(self, js: str):
        r = self.send("Runtime.evaluate", expression=js, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description", "js error"))
        return r["result"].get("value")

    def text(self) -> str:
        return self.eval("document.body.innerText")

    def wait_for(self, text: str, timeout: float = 8) -> bool:
        end = time.time() + timeout
        while time.time() < end:
            if text in self.text():
                return True
            time.sleep(0.25)
        return False

    def fill(self, selector: str, value: str) -> None:
        self.eval(f"""(() => {{ const e = document.querySelector({json.dumps(selector)});
          const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value').set;
          set.call(e, {json.dumps(value)}); e.dispatchEvent(new Event('input', {{bubbles: true}})); }})()""")

    def click(self, selector: str) -> None:
        self.eval(f"document.querySelector({json.dumps(selector)}).click()")
        time.sleep(0.4)

    def click_text(self, text: str, tag: str = "button", nth: int = 0, wait: float = 0.5, exact: bool = False) -> bool:
        want = json.dumps(text)
        test = f"e.innerText.trim() === {want}" if exact else f"e.innerText.trim().includes({want})"
        ok = self.eval(f"""(() => {{ const all = [...document.querySelectorAll({json.dumps(tag)})]
          .filter(e => ({test}) && !e.disabled);
          const e = all[{nth}]; if (!e) return false; e.click(); return true; }})()""")
        time.sleep(wait)
        return bool(ok)

    def pointer(self, selector: str, kind: str, nth: int = 0) -> None:
        """Dispatch a pointer/mouse event (e.g. 'pointerdown', 'pointerup') on the nth match."""
        self.eval(f"""(() => {{ const e = document.querySelectorAll({json.dumps(selector)})[{nth}];
          e.dispatchEvent(new PointerEvent({json.dumps(kind)}, {{bubbles: true, clientX: 5, clientY: 5}})); }})()""")

    def screenshot(self, path: str) -> None:
        import base64
        data = self.send("Page.captureScreenshot", format="png")["data"]
        Path(path).write_bytes(base64.b64decode(data))

    def full_screenshot(self, path: str) -> None:
        import base64
        h = self.eval("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)")
        self.send("Emulation.setDeviceMetricsOverride", width=1280, height=int(h), deviceScaleFactor=1, mobile=False)
        time.sleep(0.3)
        data = self.send("Page.captureScreenshot", format="png")["data"]
        Path(path).write_bytes(base64.b64decode(data))
