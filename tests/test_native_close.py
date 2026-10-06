"""Smoke-test the native window's close choice with an isolated profile."""

import tempfile
import threading
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main as app
import webview


original_create_window = webview.create_window
original_start = webview.start
loaded = threading.Event()
result = []
desktop_window = None
desktop_api = None


def capture_window(*args, **kwargs):
    global desktop_window, desktop_api
    desktop_api = kwargs['js_api']
    desktop_window = original_create_window(*args, **kwargs)
    desktop_window.events.loaded += loaded.set
    return desktop_window


def probe():
    try:
        if not loaded.wait(timeout=15):
            raise TimeoutError('Desktop UI did not load')

        tray_deadline = time.monotonic() + 5
        while not desktop_api.tray_visible and time.monotonic() < tray_deadline:
            time.sleep(0.05)
        if not desktop_api.tray_visible:
            raise AssertionError('Notification-area icon did not become visible')

        desktop_window.destroy()
        time.sleep(0.4)
        dialog_open = desktop_window.evaluate_js(
            "document.getElementById('closeOverlay').classList.contains('active')"
        )
        if not dialog_open:
            raise AssertionError('Native close did not open the close choice')

        desktop_api.handle_close_action('hide')
        desktop_api.show_window()
        desktop_api.handle_close_action('quit')
        result.append('Native close choice, tray hide, reopen, and quit: OK')
    except Exception as error:
        result.append(f'Native close smoke test failed: {error}')
        if desktop_api is not None:
            desktop_api.handle_close_action('quit')


def start_probe(func=None, args=None, **kwargs):
    def run_services_and_probe():
        threading.Thread(target=func, args=args, daemon=True).start()
        probe()

    return original_start(
        run_services_and_probe,
        http_port=app.APP_HTTP_PORT,
        private_mode=False,
        storage_path=tempfile.mkdtemp(prefix='ddl-smoke-'),
    )


webview.create_window = capture_window
webview.start = start_probe
app.main()
print(result[0] if result else 'Native close smoke test did not finish')
if not result or not result[0].endswith(': OK'):
    raise SystemExit(1)
