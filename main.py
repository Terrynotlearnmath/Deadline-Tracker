"""
Deadline Tracker — Apple-Style Desktop Application
Launches a native Windows window using pywebview to host the web UI.
"""

import os
import sys
import threading

import pystray
import webview
from PIL import Image


APP_NAME = 'DeadlineTracker'
APP_HTTP_PORT = 35743


class DesktopApi:
    """Native window actions exposed to the web UI."""

    def __init__(self):
        self._window = None
        self._tray_icon = None
        self._allow_exit = False
        self._frontend_ready = False

    def bind_window(self, window):
        self._window = window

    def bind_tray_icon(self, tray_icon):
        self._tray_icon = tray_icon

    def mark_frontend_ready(self):
        self._frontend_ready = True

    @property
    def frontend_ready(self):
        return self._frontend_ready

    @property
    def allow_exit(self):
        return self._allow_exit

    @property
    def tray_visible(self):
        return self._tray_icon is not None and self._tray_icon.visible

    def show_window(self, icon=None, item=None):
        if self._window is None:
            raise RuntimeError('Desktop window is not initialized')
        self._window.show()
        self._window.restore()

    def quit_app(self, icon=None, item=None):
        if self._window is None:
            raise RuntimeError('Desktop window is not initialized')
        self._allow_exit = True
        if self._tray_icon is not None:
            self._tray_icon.stop()
        self._window.destroy()

    def handle_close_action(self, action):
        if self._window is None:
            raise RuntimeError('Desktop window is not initialized')

        if action == 'hide':
            self._window.hide()
            return {'status': 'hidden'}

        if action == 'quit':
            self.quit_app()
            return {'status': 'closed'}

        raise ValueError(f'Unsupported close action: {action}')


def get_web_dir():
    """Get the absolute path to the web/ directory."""
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled resources here in both build modes.
        base_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, 'web')


def get_storage_dir():
    """Return a stable, per-user directory for persistent webview storage."""
    app_data_dir = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA')
    if app_data_dir:
        return os.path.join(app_data_dir, APP_NAME, 'webview')
    return os.path.join(os.path.expanduser('~'), f'.{APP_NAME.lower()}', 'webview')


def run_tray(api, icon_path):
    """Keep the app accessible from the Windows notification area."""
    with Image.open(icon_path) as source:
        tray_image = source.convert('RGBA').copy()

    tray_icon = pystray.Icon(
        APP_NAME,
        tray_image,
        'Deadline Tracker',
        menu=pystray.Menu(
            pystray.MenuItem('Open Deadline Tracker', api.show_window, default=True),
            pystray.MenuItem('End Program', api.quit_app),
        ),
    )
    api.bind_tray_icon(tray_icon)
    tray_icon.run()


def main():
    web_dir = get_web_dir()
    entry_url = os.path.join(web_dir, 'index.html')
    storage_dir = get_storage_dir()
    os.makedirs(storage_dir, exist_ok=True)
    icon_path = os.path.join(web_dir, 'icon.ico')
    tray_icon_path = os.path.join(web_dir, 'icon.png')

    api = DesktopApi()

    window = webview.create_window(
        title='Deadline Tracker',
        url=entry_url,
        js_api=api,
        width=1100,
        height=750,
        min_size=(800, 600),
        resizable=True,
        frameless=False,
        easy_drag=False,
        text_select=True,
        background_color='#0a0a0f',
    )
    api.bind_window(window)

    def on_loaded():
        api.mark_frontend_ready()

    def on_closing():
        if api.allow_exit or not api.frontend_ready:
            return True

        # Closing is a blocking event. Defer UI work until after cancellation
        # so the webview's UI thread remains responsive.
        threading.Timer(
            0.05,
            lambda: window.run_js(
                'if (window.showCloseDialog) { window.showCloseDialog(); }'
            ),
        ).start()
        return False

    window.events.loaded += on_loaded
    window.events.closing += on_closing

    webview.start(
        run_tray,
        args=(api, tray_icon_path),
        debug=False,
        http_port=APP_HTTP_PORT,
        private_mode=False,
        storage_path=storage_dir,
        icon=icon_path,
    )


if __name__ == '__main__':
    main()
