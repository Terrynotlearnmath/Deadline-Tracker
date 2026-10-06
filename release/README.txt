Deadline Tracker
================

Windows desktop app
-------------------
Unzip DeadlineTracker-Windows.zip and double-click DeadlineTracker.exe. The
Windows app is a single executable and does not require Python. Windows
WebView2 is required; it is included with current Windows 11 installations and
most updated Windows 10 installations.

The X button asks whether to keep the app running in the Windows notification
area or end the program. Click the arrow near the clock to find the icon, then
click the icon to reopen the app or right-click it for Open and End Program.
Your tasks are stored on your device under
%LOCALAPPDATA%\DeadlineTracker\webview and remain after the app closes.

Browser edition
---------------
DeadlineTracker.html is a single file. Open it in a modern browser on Windows,
macOS, or Linux. Each browser and device stores its own tasks locally. Sending
the file does not transfer your personal tasks to the recipient.

Build from source (Windows)
---------------------------
Create a Python virtual environment, install build_requirements.txt, then run
python build_release.py. The result is written to the release folder.
