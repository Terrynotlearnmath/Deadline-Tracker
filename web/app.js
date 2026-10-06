/**
 * Deadline Tracker — Core Application Logic
 * Manages tasks, countdowns, inline editing, persistence, and celebrations.
 */

(function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────────────────────
    const STORAGE_KEY = 'ddl_tracker_tasks';
    const COUNTDOWN_INTERVAL = 1000; // 1 second

    // ─── State ───────────────────────────────────────────────────────────
    let tasks = [];
    let countdownTimer = null;
    let editingTaskId = null; // null = adding new, string = editing existing

    // ─── DOM References ──────────────────────────────────────────────────
    const tasksGrid = document.getElementById('tasksGrid');
    const emptyState = document.getElementById('emptyState');
    const finishedSection = document.getElementById('finishedSection');
    const finishedList = document.getElementById('finishedList');
    const finishedGrid = document.getElementById('finishedGrid');
    const finishedCount = document.getElementById('finishedCount');
    const finishedHeader = document.getElementById('finishedHeader');
    const clearCompletedBtn = document.getElementById('clearCompletedBtn');
    const clearOverlay = document.getElementById('clearOverlay');
    const clearCancel = document.getElementById('clearCancel');
    const closeOverlay = document.getElementById('closeOverlay');
    const hideAppBtn = document.getElementById('hideAppBtn');
    const quitAppBtn = document.getElementById('quitAppBtn');
    const closeError = document.getElementById('closeError');
    const undoToast = document.getElementById('undoToast');
    const toastMessage = document.getElementById('toastMessage');
    const undoClearBtn = document.getElementById('undoClearBtn');
    const taskCountEl = document.getElementById('taskCount');
    const addBtn = document.getElementById('addBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    const modalTitle = document.getElementById('modalTitle');
    const projectTitleInput = document.getElementById('projectTitle');
    const projectDeadlineInput = document.getElementById('projectDeadline');
    const modalCancel = document.getElementById('modalCancel');
    const modalSave = document.getElementById('modalSave');
    let lastClearedTasks = [];
    let toastTimer = null;

    // ─── Utilities ───────────────────────────────────────────────────────

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    function loadTasks() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            tasks = data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load tasks:', e);
            tasks = [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (e) {
            console.error('Failed to save tasks:', e);
        }
    }

    function getClearCutoff(range) {
        const cutoff = new Date();
        if (range === 'week') {
            cutoff.setDate(cutoff.getDate() - 7);
            return cutoff.getTime();
        }
        if (range === 'month') {
            cutoff.setMonth(cutoff.getMonth() - 1);
            return cutoff.getTime();
        }
        if (range === 'all') return Number.POSITIVE_INFINITY;
        throw new Error(`Unsupported clear range: ${range}`);
    }

    function getCompletedTasksForRange(range) {
        const cutoff = getClearCutoff(range);
        return getFinishedTasks().filter(task => {
            if (range === 'all') return true;
            const finishedTime = new Date(task.finishedAt).getTime();
            return Number.isFinite(finishedTime) && finishedTime <= cutoff;
        });
    }

    function getActiveTasks() {
        return tasks.filter(t => t.status === 'active');
    }

    function getFinishedTasks() {
        return tasks.filter(t => t.status === 'finished').sort((a, b) => {
            return new Date(b.finishedAt) - new Date(a.finishedAt);
        });
    }

    /**
     * Compute the time remaining until a deadline.
     * Returns { days, hours, minutes, seconds, totalMs, overdue }
     */
    function getTimeRemaining(deadline) {
        const now = Date.now();
        const target = new Date(deadline).getTime();
        const diff = target - now;

        if (diff <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: diff, overdue: true };
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return { days, hours, minutes, seconds, totalMs: diff, overdue: false };
    }

    /**
     * Determine urgency level based on time remaining.
     */
    function getUrgencyLevel(deadline) {
        const { totalMs, overdue } = getTimeRemaining(deadline);
        if (overdue) return 'critical';
        const hoursLeft = totalMs / (1000 * 60 * 60);
        if (hoursLeft < 24) return 'critical';
        if (hoursLeft < 72) return 'danger';
        if (hoursLeft < 168) return 'warning'; // 7 days
        return 'safe';
    }

    function getUrgencyLabel(level) {
        switch (level) {
            case 'safe': return 'On Track';
            case 'warning': return 'Upcoming';
            case 'danger': return 'Urgent';
            case 'critical': return 'Critical';
            default: return '';
        }
    }

    function getUrgencyHue(deadline) {
        const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86400000;
        if (daysLeft >= 7) return 145;
        if (daysLeft <= 1) return 4;
        return 4 + (daysLeft - 1) / 6 * 141;
    }

    function setUrgencyColor(card, deadline) {
        card.style.setProperty('--urgency-hue', getUrgencyHue(deadline).toFixed(2));
    }

    function formatDeadlineDisplay(isoString) {
        const d = new Date(isoString);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const day = d.getDate();
        const year = d.getFullYear();
        const hour = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        return `${month} ${day}, ${year}  ${hour}:${min}`;
    }

    function formatDatetimeLocalValue(isoString) {
        const d = new Date(isoString);
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hr = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        return `${y}-${m}-${day}T${hr}:${min}`;
    }

    function padZero(n) {
        return n.toString().padStart(2, '0');
    }

    // ─── Rendering ───────────────────────────────────────────────────────

    function render() {
        const active = getActiveTasks();
        const finished = getFinishedTasks();

        // Update task count
        taskCountEl.textContent = `${active.length} active`;

        // Empty state
        if (active.length === 0) {
            emptyState.style.display = 'flex';
            tasksGrid.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            tasksGrid.style.display = 'grid';
        }

        // Render active tasks
        renderActiveTasks(active);

        // Render finished section
        if (finished.length > 0) {
            finishedSection.style.display = 'block';
            finishedCount.textContent = finished.length;
            renderFinishedTasks(finished);
        } else {
            finishedSection.style.display = 'none';
        }

        // Start countdown updates
        startCountdown();
    }

    function renderActiveTasks(active) {
        // Preserve existing cards where possible for smooth animations
        const existingIds = new Set();
        tasksGrid.querySelectorAll('.task-card').forEach(card => {
            existingIds.add(card.dataset.id);
        });

        const activeIds = new Set(active.map(t => t.id));

        // Remove cards that no longer exist
        tasksGrid.querySelectorAll('.task-card').forEach(card => {
            if (!activeIds.has(card.dataset.id)) {
                card.remove();
            }
        });

        // Add or update cards
        active.forEach((task, index) => {
            let card = tasksGrid.querySelector(`.task-card[data-id="${task.id}"]`);
            if (card) {
                updateCardContent(card, task);
            } else {
                card = createTaskCard(task);
                card.style.animationDelay = `${index * 60}ms`;
                tasksGrid.appendChild(card);
            }
        });
    }

    function renderFinishButton(overdue, taskId) {
        if (overdue) {
            return `
                <button class="finish-btn overdue-notice-btn" data-task-id="${taskId}" aria-label="Notice overdue task">
                    Noticed
                </button>
            `;
        }

        return `
            <button class="finish-btn" data-task-id="${taskId}" aria-label="Finish task">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-right:5px;">
                    <path d="M2.5 7.5l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Finish
            </button>
        `;
    }

    function updateFinishButton(button, overdue) {
        button.classList.toggle('overdue-notice-btn', overdue);
        button.setAttribute('aria-label', overdue ? 'Notice overdue task' : 'Finish task');
        button.innerHTML = overdue
            ? 'Noticed'
            : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-right:5px;">
                   <path d="M2.5 7.5l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
               Finish`;
    }

    function createTaskCard(task) {
        const urgency = getUrgencyLevel(task.deadline);
        const remaining = getTimeRemaining(task.deadline);

        const card = document.createElement('div');
        card.className = `task-card urgency-${urgency}`;
        card.dataset.id = task.id;
        setUrgencyColor(card, task.deadline);

        card.innerHTML = `
            <div class="card-header">
                <div class="task-title" contenteditable="true" spellcheck="false" data-task-id="${task.id}">${escapeHtml(task.title)}</div>
                <div class="card-actions">
                    <button class="card-action-btn edit-btn" title="Edit" data-task-id="${task.id}">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M10.5 1.75a1.77 1.77 0 012.5 2.5L4.75 12.5l-3.5 1 1-3.5L10.5 1.75z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="card-action-btn delete-btn" title="Delete" data-task-id="${task.id}">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 4h9M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 8h6l.5-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="deadline-row" data-task-id="${task.id}">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M1.5 5.5h11M4.5 1v3M9.5 1v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span class="deadline-text">${formatDeadlineDisplay(task.deadline)}</span>
                <input type="datetime-local" class="deadline-input" data-task-id="${task.id}" value="${formatDatetimeLocalValue(task.deadline)}">
            </div>
            <div class="countdown-display" data-task-id="${task.id}">
                ${remaining.overdue ? renderOverdueCountdown() : renderCountdownSegments(remaining)}
            </div>
            <div class="card-footer">
                <span class="urgency-badge badge-${urgency}">${getUrgencyLabel(urgency)}</span>
                ${renderFinishButton(remaining.overdue, task.id)}
            </div>
        `;

        // Event listeners
        attachCardEvents(card, task);

        return card;
    }

    function attachCardEvents(card, task) {
        // Inline title editing
        const titleEl = card.querySelector('.task-title');
        titleEl.addEventListener('blur', () => {
            const newTitle = titleEl.textContent.trim();
            if (newTitle && newTitle !== task.title) {
                task.title = newTitle;
                saveTasks();
            } else if (!newTitle) {
                titleEl.textContent = task.title;
            }
        });
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
        });

        // Deadline click → open hidden datetime picker
        const deadlineRow = card.querySelector('.deadline-row');
        const hiddenInput = card.querySelector('.deadline-input');
        deadlineRow.addEventListener('click', (e) => {
            if (e.target === hiddenInput) return;
            hiddenInput.showPicker ? hiddenInput.showPicker() : hiddenInput.click();
        });
        hiddenInput.addEventListener('change', () => {
            if (hiddenInput.value) {
                task.deadline = new Date(hiddenInput.value).toISOString();
                saveTasks();
                render();
            }
        });

        // Edit button → open modal
        card.querySelector('.edit-btn').addEventListener('click', () => {
            openEditModal(task.id);
        });

        // Delete button
        card.querySelector('.delete-btn').addEventListener('click', () => {
            deleteTask(task.id);
        });

        // Finish button
        card.querySelector('.finish-btn').addEventListener('click', () => {
            finishTask(task.id, card);
        });
    }

    function updateCardContent(card, task) {
        const urgency = getUrgencyLevel(task.deadline);
        const remaining = getTimeRemaining(task.deadline);

        // Update urgency class
        card.className = `task-card urgency-${urgency}`;
        card.dataset.id = task.id;
        setUrgencyColor(card, task.deadline);

        // Update countdown
        const countdownEl = card.querySelector('.countdown-display');
        if (countdownEl) {
            countdownEl.innerHTML = remaining.overdue ? renderOverdueCountdown() : renderCountdownSegments(remaining);
        }

        // Update urgency badge
        const badge = card.querySelector('.urgency-badge');
        if (badge) {
            badge.className = `urgency-badge badge-${urgency}`;
            badge.textContent = getUrgencyLabel(urgency);
        }

        const finishBtn = card.querySelector('.finish-btn');
        if (finishBtn && !finishBtn.disabled) {
            updateFinishButton(finishBtn, remaining.overdue);
        }

        // Update deadline text
        const deadlineText = card.querySelector('.deadline-text');
        if (deadlineText) {
            deadlineText.textContent = formatDeadlineDisplay(task.deadline);
        }
    }

    function renderCountdownSegments(remaining) {
        return `
            <div class="countdown-segment">
                <span class="countdown-value">${remaining.days}</span>
                <span class="countdown-label">Days</span>
            </div>
            <span class="countdown-separator">·</span>
            <div class="countdown-segment">
                <span class="countdown-value">${padZero(remaining.hours)}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <span class="countdown-separator">·</span>
            <div class="countdown-segment">
                <span class="countdown-value">${padZero(remaining.minutes)}</span>
                <span class="countdown-label">Min</span>
            </div>
            <span class="countdown-separator">·</span>
            <div class="countdown-segment">
                <span class="countdown-value">${padZero(remaining.seconds)}</span>
                <span class="countdown-label">Sec</span>
            </div>
        `;
    }

    function renderOverdueCountdown() {
        return `
            <div class="countdown-overdue">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 6px;">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Overdue
            </div>
        `;
    }

    function renderFinishedTasks(finished) {
        finishedGrid.innerHTML = '';
        finished.forEach(task => {
            const card = document.createElement('div');
            card.className = 'finished-card';
            card.dataset.id = task.id;

            const finishedDate = task.finishedAt ? formatDeadlineDisplay(task.finishedAt) : 'Unknown';
            const wasOverdue = task.completionType === 'overdue';
            const statusIcon = wasOverdue ? '' : `
                <svg class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" fill="rgba(52,199,89,0.15)" stroke="#34C759" stroke-width="1.2"/>
                    <path d="M5 8l2 2 4-4" stroke="#34C759" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            const statusBadge = wasOverdue
                ? '<span class="finished-badge finished-badge-overdue">Overdue</span>'
                : '<span class="finished-badge">✓ Finished</span>';

            card.innerHTML = `
                <div class="card-header">
                    <div class="finished-task-title">
                        ${statusIcon}
                        <span>${escapeHtml(task.title)}</span>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn delete-btn" title="Remove" data-task-id="${task.id}">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2.5 4h9M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 8h6l.5-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="finished-meta">
                    ${statusBadge}
                    <span class="finished-date">Completed ${finishedDate}</span>
                </div>
            `;

            // Delete from finished
            card.querySelector('.delete-btn').addEventListener('click', () => {
                deleteTask(task.id);
            });

            finishedGrid.appendChild(card);
        });
    }

    // ─── Countdown Timer ─────────────────────────────────────────────────

    function startCountdown() {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
            const active = getActiveTasks();
            active.forEach(task => {
                const card = tasksGrid.querySelector(`.task-card[data-id="${task.id}"]`);
                if (card) {
                    updateCardContent(card, task);
                }
            });
        }, COUNTDOWN_INTERVAL);
    }

    // ─── Modal ───────────────────────────────────────────────────────────

    function openAddModal() {
        editingTaskId = null;
        modalTitle.textContent = 'New Project';
        projectTitleInput.value = '';

        // Default deadline: 7 days from now
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 7);
        projectDeadlineInput.value = formatDatetimeLocalValue(defaultDeadline.toISOString());

        modalSave.textContent = 'Add Project';
        showModal();
    }

    function openEditModal(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        editingTaskId = taskId;
        modalTitle.textContent = 'Edit Project';
        projectTitleInput.value = task.title;
        projectDeadlineInput.value = formatDatetimeLocalValue(task.deadline);
        modalSave.textContent = 'Save Changes';
        showModal();
    }

    function showModal() {
        modalOverlay.classList.add('active');
        modalOverlay.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            projectTitleInput.focus();
        });
    }

    function hideModal() {
        modalOverlay.classList.remove('active');
        modalOverlay.setAttribute('aria-hidden', 'true');
        editingTaskId = null;
    }

    function handleModalSave() {
        const title = projectTitleInput.value.trim();
        const deadline = projectDeadlineInput.value;

        if (!title) {
            projectTitleInput.classList.add('input-error');
            projectTitleInput.focus();
            setTimeout(() => projectTitleInput.classList.remove('input-error'), 600);
            return;
        }
        if (!deadline) {
            projectDeadlineInput.classList.add('input-error');
            projectDeadlineInput.focus();
            setTimeout(() => projectDeadlineInput.classList.remove('input-error'), 600);
            return;
        }

        if (editingTaskId) {
            // Edit existing
            const task = tasks.find(t => t.id === editingTaskId);
            if (task) {
                task.title = title;
                task.deadline = new Date(deadline).toISOString();
            }
        } else {
            // Add new
            tasks.push({
                id: generateId(),
                title: title,
                deadline: new Date(deadline).toISOString(),
                createdAt: new Date().toISOString(),
                finishedAt: null,
                status: 'active',
            });
        }

        saveTasks();
        hideModal();
        render();
    }

    // ─── Task Actions ────────────────────────────────────────────────────

    function deleteTask(taskId) {
        const card = tasksGrid.querySelector(`.task-card[data-id="${taskId}"]`)
            || finishedGrid.querySelector(`.finished-card[data-id="${taskId}"]`);

        if (card) {
            card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            card.style.transform = 'scale(0.9)';
            card.style.opacity = '0';
            setTimeout(() => {
                tasks = tasks.filter(t => t.id !== taskId);
                saveTasks();
                render();
            }, 300);
        } else {
            tasks = tasks.filter(t => t.id !== taskId);
            saveTasks();
            render();
        }
    }

    function finishTask(taskId, card) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Disable the finish button to prevent double-clicks
        const finishBtn = card.querySelector('.finish-btn');
        if (finishBtn && finishBtn.disabled) return;
        if (finishBtn) finishBtn.disabled = true;

        const wasOverdue = getTimeRemaining(task.deadline).overdue;

        if (wasOverdue) {
            // Overdue tasks stay visible long enough to acknowledge the action,
            // then move to Completed without the full-screen celebration.
            task.status = 'finished';
            task.finishedAt = new Date().toISOString();
            task.completionType = 'overdue';
            saveTasks();

            if (finishBtn) {
                updateFinishButton(finishBtn, true);
                finishBtn.classList.add('overdue-noticed');
                finishBtn.textContent = 'Add Oil💪';
            }

            setTimeout(() => {
                card.classList.add('finishing');
                setTimeout(() => render(), 500);
            }, 750);
            return;
        }

        // Persist the completed state before the celebration so an immediate
        // app close cannot lose the user's action.
        task.status = 'finished';
        task.finishedAt = new Date().toISOString();
        task.completionType = 'finished';
        saveTasks();

        // Trigger fireworks celebration
        window.showCelebration(() => {
            // After celebration, animate the card out
            card.classList.add('finishing');

            setTimeout(() => {
                render();
            }, 500);
        });
    }

    // ─── Finished Section Toggle ─────────────────────────────────────────

    let finishedExpanded = false;

    function toggleFinished() {
        finishedExpanded = !finishedExpanded;
        const list = document.getElementById('finishedList');
        const header = document.getElementById('finishedHeader');

        if (finishedExpanded) {
            list.classList.add('expanded');
            header.classList.add('expanded');
            header.setAttribute('aria-expanded', 'true');
        } else {
            list.classList.remove('expanded');
            header.classList.remove('expanded');
            header.setAttribute('aria-expanded', 'false');
        }
    }

    // ─── Completed Task Clearing ─────────────────────────────────────────

    function updateClearCounts() {
        ['week', 'month', 'all'].forEach(range => {
            const count = getCompletedTasksForRange(range).length;
            const countEl = clearOverlay.querySelector(`[data-clear-count="${range}"]`);
            const option = clearOverlay.querySelector(`[data-clear-range="${range}"]`);
            countEl.textContent = `${count} ${count === 1 ? 'task' : 'tasks'}`;
            option.disabled = count === 0;
        });
    }

    function showClearSheet() {
        updateClearCounts();
        clearOverlay.classList.add('active');
        clearOverlay.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            const firstEnabled = clearOverlay.querySelector('.clear-option:not(:disabled)');
            (firstEnabled || clearCancel).focus();
        });
    }

    function hideClearSheet() {
        clearOverlay.classList.remove('active');
        clearOverlay.setAttribute('aria-hidden', 'true');
        clearCompletedBtn.focus();
    }

    function clearCompletedTasks(range) {
        const toClear = getCompletedTasksForRange(range);
        if (toClear.length === 0) return;

        const clearedIds = new Set(toClear.map(task => task.id));
        lastClearedTasks = toClear;
        tasks = tasks.filter(task => !clearedIds.has(task.id));
        saveTasks();
        hideClearSheet();

        finishedGrid.querySelectorAll('.finished-card').forEach(card => {
            if (clearedIds.has(card.dataset.id)) card.classList.add('clearing');
        });

        window.setTimeout(() => {
            render();
            showUndoToast(toClear.length);
        }, 260);
    }

    function showUndoToast(count) {
        if (toastTimer) window.clearTimeout(toastTimer);
        toastMessage.textContent = `${count} completed ${count === 1 ? 'task' : 'tasks'} cleared`;
        undoToast.classList.add('visible');
        undoToast.setAttribute('aria-hidden', 'false');
        toastTimer = window.setTimeout(hideUndoToast, 6000);
    }

    function hideUndoToast() {
        undoToast.classList.remove('visible');
        undoToast.setAttribute('aria-hidden', 'true');
        toastTimer = null;
    }

    function undoClear() {
        if (lastClearedTasks.length === 0) return;
        tasks = tasks.concat(lastClearedTasks);
        lastClearedTasks = [];
        saveTasks();
        render();
        hideUndoToast();
    }

    // ─── Desktop Close Choice ────────────────────────────────────────────

    window.showCloseDialog = function () {
        closeError.textContent = '';
        closeOverlay.classList.add('active');
        closeOverlay.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => hideAppBtn.focus());
    };

    function hideCloseDialog() {
        closeOverlay.classList.remove('active');
        closeOverlay.setAttribute('aria-hidden', 'true');
    }

    async function handleDesktopClose(action) {
        if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.handle_close_action) {
            closeError.textContent = 'Desktop controls are unavailable in this browser.';
            return;
        }

        hideAppBtn.disabled = true;
        quitAppBtn.disabled = true;
        closeError.textContent = '';

        try {
            hideCloseDialog();
            await window.pywebview.api.handle_close_action(action);
        } catch (error) {
            closeOverlay.classList.add('active');
            closeOverlay.setAttribute('aria-hidden', 'false');
            closeError.textContent = `Could not ${action === 'quit' ? 'end the program' : 'hide the app'}: ${error}`;
        } finally {
            hideAppBtn.disabled = false;
            quitAppBtn.disabled = false;
        }
    }

    // ─── Escape HTML ─────────────────────────────────────────────────────

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Event Bindings ──────────────────────────────────────────────────

    addBtn.addEventListener('click', openAddModal);
    modalCancel.addEventListener('click', hideModal);
    modalSave.addEventListener('click', handleModalSave);
    finishedHeader.addEventListener('click', toggleFinished);
    clearCompletedBtn.addEventListener('click', showClearSheet);
    clearCancel.addEventListener('click', hideClearSheet);
    undoClearBtn.addEventListener('click', undoClear);
    hideAppBtn.addEventListener('click', () => handleDesktopClose('hide'));
    quitAppBtn.addEventListener('click', () => handleDesktopClose('quit'));
    clearOverlay.querySelectorAll('[data-clear-range]').forEach(option => {
        option.addEventListener('click', () => clearCompletedTasks(option.dataset.clearRange));
    });

    // Close modal on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });
    clearOverlay.addEventListener('click', (e) => {
        if (e.target === clearOverlay) hideClearSheet();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (closeOverlay.classList.contains('active')) {
                hideCloseDialog();
            } else if (clearOverlay.classList.contains('active')) {
                hideClearSheet();
            } else if (modalOverlay.classList.contains('active')) {
                hideModal();
            }
        }
        if (e.key === 'Enter' && modalOverlay.classList.contains('active')) {
            // Only if not focused on title input (allow multiline? no, single line)
            if (document.activeElement === projectTitleInput || document.activeElement === projectDeadlineInput) {
                handleModalSave();
            }
        }
    });

    // ─── Initialize ──────────────────────────────────────────────────────

    loadTasks();
    render();

})();
