# Deadline Tracker

An Apple-inspired deadline tracker for Windows, with a standalone browser edition.

## Use the app

For Windows, download `release/DeadlineTracker-Windows.zip`, unzip it, and run
`release/DeadlineTracker.exe`. The compact release is a single executable and
does not require Python. Windows WebView2 is required.

You can also open `release/DeadlineTracker.html` in a modern browser. Browser
tasks are stored locally in that browser and are not shared with the Windows app.

The Windows app stores tasks per device under:

```text
%LOCALAPPDATA%\DeadlineTracker\webview
```

Task data is intentionally not committed to GitHub.

## Project layout

- `main.py` — native pywebview window, persistent storage, and notification-area tray behavior.
- `web/` — editable HTML, CSS, JavaScript, and icon assets.
- `tests/` — native smoke tests and feature checks.
- `build_release.py` — regenerates the browser file and compact Windows executable.
- `release/` — shareable EXE, ZIP, browser HTML, and release instructions.

## Build from source

On Windows with Python 3.12 or newer:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r build_requirements.txt
python build_release.py
```

The generated files are written to `release/`. The build script automatically
removes its temporary `build/` directory after a successful build.

## Add features in the future

1. Pull the latest code and create a feature branch:

   ```powershell
   git pull origin main
   git switch -c feature/your-feature-name
   ```

2. Make focused changes. Most UI and behavior changes belong in `web/app.js`,
   `web/styles.css`, or `web/index.html`. Native window and tray changes belong
   in `main.py`.

3. Run checks before building:

   ```powershell
   node --check web/app.js
   node --check web/fireworks.js
   python tests/test_native_close.py
   python tests/test_native_persistence.py
   ```

4. Rebuild the distributable:

   ```powershell
   python build_release.py
   ```

5. Review the changed files, commit, and push:

   ```powershell
   git status
   git add .
   git commit -m "Describe the feature"
   git push -u origin feature/your-feature-name
   ```

Then open a pull request on GitHub. After review, merge the branch into `main`.

Do not commit `.venv/`, `build/`, Python caches, or personal task data. The
release artifacts are kept in the repository so they can be downloaded directly.
