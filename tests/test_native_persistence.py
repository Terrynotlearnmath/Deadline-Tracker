"""Verify a task survives separate native app launches."""

import subprocess
import sys
import tempfile
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main as app
import webview


def run_phase(phase, storage_path):
    loaded = threading.Event()
    result = []
    original_create_window = webview.create_window
    original_start = webview.start
    window = None
    api = None

    def capture_window(*args, **kwargs):
        nonlocal window, api
        api = kwargs['js_api']
        window = original_create_window(*args, **kwargs)
        window.events.loaded += loaded.set
        return window

    def probe():
        try:
            if not loaded.wait(timeout=15):
                raise TimeoutError('Desktop UI did not load')
            if phase == 'write':
                window.evaluate_js("document.getElementById('addBtn').click()")
                window.evaluate_js("document.getElementById('projectTitle').value = 'Persistence smoke test'")
                window.evaluate_js("document.getElementById('projectDeadline').value = '2026-12-01T12:00'")
                window.evaluate_js("document.getElementById('modalSave').click()")
            title = window.evaluate_js("document.querySelector('.task-title')?.textContent")
            if title != 'Persistence smoke test':
                raise AssertionError(f'Expected persisted task, got {title!r}')
            result.append(True)
        except Exception as error:
            result.append(error)
        finally:
            api.handle_close_action('quit')

    def start_probe(func=None, args=None, **kwargs):
        return original_start(probe, **kwargs)

    app.get_storage_dir = lambda: storage_path
    webview.create_window = capture_window
    webview.start = start_probe
    app.main()
    if not result or result[0] is not True:
        raise RuntimeError(result[0] if result else 'Persistence probe did not finish')


if __name__ == '__main__':
    if len(sys.argv) == 3:
        run_phase(sys.argv[1], sys.argv[2])
    else:
        with tempfile.TemporaryDirectory(prefix='ddl-persistence-', ignore_cleanup_errors=True) as profile:
            script = str(Path(__file__).resolve())
            for phase in ('write', 'read'):
                subprocess.run([sys.executable, script, phase, profile], check=True, timeout=30)
        print('Native task persistence across launches: OK')
