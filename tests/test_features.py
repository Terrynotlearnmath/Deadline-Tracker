"""
Deadline Tracker — Automated Feature Test Suite
Tests all core features by evaluating JavaScript in the pywebview window.
"""

import sys
import time
import threading
from pathlib import Path

import webview


# ─── Test Results ─────────────────────────────────────────────────────
results = []


def log(status, feature, detail=""):
    icon = "✅" if status == "PASS" else "❌"
    results.append((status, feature, detail))
    print(f"  {icon} {feature}" + (f" — {detail}" if detail else ""))


def run_tests(window):
    """Run all feature tests after the window loads."""
    time.sleep(3)  # Wait for DOM + scripts to fully initialize

    print("\n" + "=" * 60)
    print("  DEADLINE TRACKER — AUTOMATED FEATURE TESTS")
    print("=" * 60 + "\n")

    # ── Test 1: Empty state shows on startup ──────────────────────────
    print("[1] Initial State")
    try:
        empty_visible = window.evaluate_js(
            "document.getElementById('emptyState').style.display !== 'none'"
        )
        log("PASS" if empty_visible else "FAIL",
            "Empty state visible on startup",
            f"display={'visible' if empty_visible else 'hidden'}")

        task_count = window.evaluate_js(
            "document.getElementById('taskCount').textContent"
        )
        log("PASS" if "0" in str(task_count) else "FAIL",
            "Task count shows 0 active",
            f"text='{task_count}'")
    except Exception as e:
        log("FAIL", "Initial state check", str(e))

    # ── Test 2: Add a project via modal ───────────────────────────────
    print("\n[2] Add Project")
    try:
        # Click add button to open modal
        window.evaluate_js("document.getElementById('addBtn').click()")
        time.sleep(0.5)

        modal_active = window.evaluate_js(
            "document.getElementById('modalOverlay').classList.contains('active')"
        )
        log("PASS" if modal_active else "FAIL",
            "Modal opens on + button click",
            f"active={modal_active}")

        # Fill in project details
        window.evaluate_js("""
            document.getElementById('projectTitle').value = 'Test Project Alpha';
            document.getElementById('projectDeadline').value = '2026-10-12T18:00';
        """)
        time.sleep(0.3)

        # Click save
        window.evaluate_js("document.getElementById('modalSave').click()")
        time.sleep(0.8)

        modal_closed = window.evaluate_js(
            "!document.getElementById('modalOverlay').classList.contains('active')"
        )
        log("PASS" if modal_closed else "FAIL",
            "Modal closes after save")

        # Check card was created
        card_count = window.evaluate_js(
            "document.querySelectorAll('.task-card').length"
        )
        log("PASS" if card_count == 1 else "FAIL",
            "Task card created",
            f"count={card_count}")

        # Check empty state is hidden
        empty_hidden = window.evaluate_js(
            "document.getElementById('emptyState').style.display === 'none'"
        )
        log("PASS" if empty_hidden else "FAIL",
            "Empty state hidden after adding task")

        # Verify title on card
        card_title = window.evaluate_js(
            "document.querySelector('.task-title')?.textContent"
        )
        log("PASS" if card_title == "Test Project Alpha" else "FAIL",
            "Card displays correct title",
            f"title='{card_title}'")
    except Exception as e:
        log("FAIL", "Add project", str(e))

    # ── Test 3: Live countdown ────────────────────────────────────────
    print("\n[3] Live Countdown")
    try:
        countdown_val1 = window.evaluate_js(
            "document.querySelector('.countdown-value')?.textContent"
        )
        time.sleep(2)
        countdown_val2 = window.evaluate_js(
            "document.querySelector('.countdown-value')?.textContent"
        )

        has_countdown = countdown_val1 is not None and countdown_val1 != ""
        log("PASS" if has_countdown else "FAIL",
            "Countdown values displayed",
            f"value='{countdown_val1}'")

        # Check countdown segments exist
        seg_count = window.evaluate_js(
            "document.querySelectorAll('.countdown-segment').length"
        )
        log("PASS" if seg_count == 4 else "FAIL",
            "4 countdown segments (days/hrs/min/sec)",
            f"segments={seg_count}")
    except Exception as e:
        log("FAIL", "Live countdown", str(e))

    # ── Test 4: Urgency color coding ──────────────────────────────────
    print("\n[4] Urgency System")
    try:
        urgency_class = window.evaluate_js(
            "document.querySelector('.task-card')?.className"
        )
        has_urgency = urgency_class and ("urgency-safe" in urgency_class
                                          or "urgency-warning" in urgency_class
                                          or "urgency-danger" in urgency_class
                                          or "urgency-critical" in urgency_class)
        log("PASS" if has_urgency else "FAIL",
            "Card has urgency class",
            f"class='{urgency_class}'")

        badge_text = window.evaluate_js(
            "document.querySelector('.urgency-badge')?.textContent"
        )
        valid_labels = ["On Track", "Upcoming", "Urgent", "Critical"]
        log("PASS" if badge_text in valid_labels else "FAIL",
            "Urgency badge shows correct label",
            f"badge='{badge_text}'")
    except Exception as e:
        log("FAIL", "Urgency system", str(e))

    # ── Test 5: Add a second project ──────────────────────────────────
    print("\n[5] Multiple Projects")
    try:
        window.evaluate_js("document.getElementById('addBtn').click()")
        time.sleep(0.5)
        window.evaluate_js("""
            document.getElementById('projectTitle').value = 'Test Project Beta';
            document.getElementById('projectDeadline').value = '2026-10-07T09:00';
        """)
        window.evaluate_js("document.getElementById('modalSave').click()")
        time.sleep(0.8)

        card_count = window.evaluate_js(
            "document.querySelectorAll('.task-card').length"
        )
        log("PASS" if card_count == 2 else "FAIL",
            "Second task card created",
            f"count={card_count}")

        task_count_text = window.evaluate_js(
            "document.getElementById('taskCount').textContent"
        )
        log("PASS" if "2" in str(task_count_text) else "FAIL",
            "Task count updated to 2",
            f"text='{task_count_text}'")
    except Exception as e:
        log("FAIL", "Multiple projects", str(e))

    # ── Test 6: Inline title editing ──────────────────────────────────
    print("\n[6] Inline Title Editing")
    try:
        window.evaluate_js("""
            (function() {
                var title = document.querySelector('.task-title');
                title.focus();
                title.textContent = 'Renamed Project';
                title.blur();
            })();
        """)
        time.sleep(0.5)

        new_title = window.evaluate_js(
            "document.querySelector('.task-title')?.textContent"
        )
        log("PASS" if new_title == "Renamed Project" else "FAIL",
            "Title updated via inline edit",
            f"title='{new_title}'")

        # Check it persisted to localStorage
        stored = window.evaluate_js("""
            JSON.parse(localStorage.getItem('ddl_tracker_tasks'))[0].title
        """)
        log("PASS" if stored == "Renamed Project" else "FAIL",
            "Edited title persisted to localStorage",
            f"stored='{stored}'")
    except Exception as e:
        log("FAIL", "Inline title editing", str(e))

    # ── Test 7: Edit via modal ────────────────────────────────────────
    print("\n[7] Edit via Modal")
    try:
        window.evaluate_js(
            "document.querySelector('.edit-btn').click()"
        )
        time.sleep(0.5)

        modal_title = window.evaluate_js(
            "document.getElementById('modalTitle').textContent"
        )
        log("PASS" if modal_title == "Edit Project" else "FAIL",
            "Modal opens in edit mode",
            f"title='{modal_title}'")

        prefilled = window.evaluate_js(
            "document.getElementById('projectTitle').value"
        )
        log("PASS" if prefilled == "Renamed Project" else "FAIL",
            "Modal pre-filled with current title",
            f"value='{prefilled}'")

        # Change and save
        window.evaluate_js("""
            document.getElementById('projectTitle').value = 'Final Project Name';
        """)
        window.evaluate_js("document.getElementById('modalSave').click()")
        time.sleep(0.8)

        updated = window.evaluate_js(
            "document.querySelector('.task-title')?.textContent"
        )
        log("PASS" if updated == "Final Project Name" else "FAIL",
            "Title updated via modal edit",
            f"title='{updated}'")
    except Exception as e:
        log("FAIL", "Edit via modal", str(e))

    # ── Test 8: LocalStorage persistence ──────────────────────────────
    print("\n[8] Data Persistence")
    try:
        stored_data = window.evaluate_js("""
            JSON.parse(localStorage.getItem('ddl_tracker_tasks')).length
        """)
        log("PASS" if stored_data == 2 else "FAIL",
            "2 tasks stored in localStorage",
            f"count={stored_data}")

        has_fields = window.evaluate_js("""
            (function() {
                var t = JSON.parse(localStorage.getItem('ddl_tracker_tasks'))[0];
                return t.id && t.title && t.deadline && t.createdAt && t.status === 'active';
            })()
        """)
        log("PASS" if has_fields else "FAIL",
            "Task has all required fields (id, title, deadline, createdAt, status)")
    except Exception as e:
        log("FAIL", "Data persistence", str(e))

    # ── Test 9: Finish task → fireworks → finished stack ──────────────
    print("\n[9] Finish Task + Celebration")
    try:
        # Click finish on the second card (Project Beta)
        window.evaluate_js("""
            document.querySelectorAll('.finish-btn')[1].click()
        """)
        time.sleep(1)

        # Check fireworks overlay appeared
        fireworks_exists = window.evaluate_js("""
            document.querySelector('.fireworks-overlay') !== null
            || document.querySelector('canvas') !== null
        """)
        log("PASS" if fireworks_exists else "FAIL",
            "Fireworks/celebration overlay appeared")

        # Wait for celebration to finish
        time.sleep(3.5)

        # Check card moved to finished
        active_count = window.evaluate_js(
            "document.querySelectorAll('.task-card').length"
        )
        log("PASS" if active_count == 1 else "FAIL",
            "Active tasks reduced to 1 after finish",
            f"active={active_count}")

        finished_visible = window.evaluate_js(
            "document.getElementById('finishedSection').style.display !== 'none'"
        )
        log("PASS" if finished_visible else "FAIL",
            "Finished section now visible")

        finished_count_text = window.evaluate_js(
            "document.getElementById('finishedCount').textContent"
        )
        log("PASS" if "1" in str(finished_count_text) else "FAIL",
            "Finished count shows 1",
            f"text='{finished_count_text}'")
    except Exception as e:
        log("FAIL", "Finish task + celebration", str(e))

    # ── Test 10: Expand finished section ──────────────────────────────
    print("\n[10] Finished Section Toggle")
    try:
        window.evaluate_js(
            "document.getElementById('finishedHeader').click()"
        )
        time.sleep(0.6)

        expanded = window.evaluate_js(
            "document.getElementById('finishedList').classList.contains('expanded')"
        )
        log("PASS" if expanded else "FAIL",
            "Finished list expands on click")

        finished_cards = window.evaluate_js(
            "document.querySelectorAll('.finished-card').length"
        )
        log("PASS" if finished_cards == 1 else "FAIL",
            "Finished card rendered",
            f"count={finished_cards}")

        has_badge = window.evaluate_js(
            "document.querySelector('.finished-badge')?.textContent?.includes('Finished')"
        )
        log("PASS" if has_badge else "FAIL",
            "Finished card has '✓ Finished' badge")

        # Collapse
        window.evaluate_js(
            "document.getElementById('finishedHeader').click()"
        )
        time.sleep(0.6)

        collapsed = window.evaluate_js(
            "!document.getElementById('finishedList').classList.contains('expanded')"
        )
        log("PASS" if collapsed else "FAIL",
            "Finished list collapses on second click")
    except Exception as e:
        log("FAIL", "Finished section toggle", str(e))

    # ── Test 11: Delete a task ────────────────────────────────────────
    print("\n[11] Delete Task")
    try:
        # Add a throwaway task
        window.evaluate_js("document.getElementById('addBtn').click()")
        time.sleep(0.5)
        window.evaluate_js("""
            document.getElementById('projectTitle').value = 'To Be Deleted';
            document.getElementById('projectDeadline').value = '2026-12-25T00:00';
        """)
        window.evaluate_js("document.getElementById('modalSave').click()")
        time.sleep(0.8)

        count_before = window.evaluate_js(
            "document.querySelectorAll('.task-card').length"
        )

        # Click delete on the new card (last one)
        window.evaluate_js("""
            var cards = document.querySelectorAll('.task-card');
            var lastCard = cards[cards.length - 1];
            lastCard.querySelector('.delete-btn').click();
        """)
        time.sleep(0.8)

        count_after = window.evaluate_js(
            "document.querySelectorAll('.task-card').length"
        )
        log("PASS" if count_after == count_before - 1 else "FAIL",
            "Task deleted successfully",
            f"before={count_before}, after={count_after}")
    except Exception as e:
        log("FAIL", "Delete task", str(e))

    # ── Test 12: Modal cancel / Escape ────────────────────────────────
    print("\n[12] Modal Cancel / Escape")
    try:
        window.evaluate_js("document.getElementById('addBtn').click()")
        time.sleep(0.5)

        # Click cancel
        window.evaluate_js("document.getElementById('modalCancel').click()")
        time.sleep(0.4)

        closed = window.evaluate_js(
            "!document.getElementById('modalOverlay').classList.contains('active')"
        )
        log("PASS" if closed else "FAIL",
            "Modal closes on Cancel click")

        # Open again, press Escape
        window.evaluate_js("document.getElementById('addBtn').click()")
        time.sleep(0.5)
        window.evaluate_js("""
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        """)
        time.sleep(0.4)

        closed2 = window.evaluate_js(
            "!document.getElementById('modalOverlay').classList.contains('active')"
        )
        log("PASS" if closed2 else "FAIL",
            "Modal closes on Escape key")
    except Exception as e:
        log("FAIL", "Modal cancel/escape", str(e))

    # ── Test 13: CSS / Visual checks ──────────────────────────────────
    print("\n[13] Visual / CSS Checks")
    try:
        bg_color = window.evaluate_js(
            "getComputedStyle(document.body).backgroundColor"
        )
        is_dark = "0" in str(bg_color) or "10" in str(bg_color) or "12" in str(bg_color)
        log("PASS" if is_dark else "FAIL",
            "Dark theme background applied",
            f"bg='{bg_color}'")

        card_radius = window.evaluate_js(
            "getComputedStyle(document.querySelector('.task-card')).borderRadius"
        )
        log("PASS" if "16px" in str(card_radius) else "FAIL",
            "Cards have 16px border-radius",
            f"radius='{card_radius}'")

        header_height = window.evaluate_js(
            "document.querySelector('.app-header').offsetHeight"
        )
        log("PASS" if header_height and int(header_height) >= 50 else "FAIL",
            "Header has proper height",
            f"height={header_height}px")

        font = window.evaluate_js(
            "getComputedStyle(document.body).fontFamily"
        )
        log("PASS" if "Inter" in str(font) or "apple-system" in str(font) else "FAIL",
            "Apple-style font family applied",
            f"font='{font}'")
    except Exception as e:
        log("FAIL", "Visual/CSS checks", str(e))

    # ── Summary ───────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r[0] == "PASS")
    failed = sum(1 for r in results if r[0] == "FAIL")
    total = len(results)
    print(f"  RESULTS: {passed}/{total} passed, {failed} failed")
    print("=" * 60 + "\n")

    if failed > 0:
        print("  Failed tests:")
        for status, feature, detail in results:
            if status == "FAIL":
                print(f"    ❌ {feature}" + (f" — {detail}" if detail else ""))
        print()


def main():
    entry_url = Path(__file__).resolve().parents[1] / 'web' / 'index.html'

    window = webview.create_window(
        title='Deadline Tracker — TEST MODE',
        url=str(entry_url),
        width=1100,
        height=750,
        min_size=(800, 600),
        resizable=True,
        frameless=False,
        easy_drag=False,
        text_select=True,
        background_color='#0a0a0f',
    )

    # Clear localStorage before tests
    def on_loaded():
        time.sleep(1)
        window.evaluate_js("localStorage.removeItem('ddl_tracker_tasks')")
        window.evaluate_js("location.reload()")
        time.sleep(2)
        run_tests(window)

    t = threading.Thread(target=on_loaded, daemon=True)
    t.start()

    webview.start(debug=True)


if __name__ == '__main__':
    main()
