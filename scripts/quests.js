// tasks and egg progress
function isTaskDueToday(task) {
  if (task.repeatDays.length) return task.repeatDays.includes(new Date().getDay());
  if (!task.completed) return true;
  return task.completedAt ? localDay(new Date(task.completedAt)) === localDay() : false;
}

function visibleTasks() {
  return currentTaskView === "all" ? gameState.tasks : gameState.tasks.filter(isTaskDueToday);
}

function renderTasks() {
  const tasks = visibleTasks();
  taskList.innerHTML = tasks.map((task) => {
    const completedToday = task.repeatDays.length > 0 && task.lastCompletedDay === localDay();
    const done = task.completed || completedToday;
    const timed = task.taskType === "timed";
    const requiredMs = timed ? getTaskDurationSeconds(task) * 1000 : 0;
    const elapsedMs = task.startedAt
      ? Date.now() - new Date(task.startedAt).getTime()
      : 0;
    const timerReady = !timed || elapsedMs >= requiredMs;
    const progress = task.startedAt && requiredMs ? Math.min(100, elapsedMs / requiredMs * 100) : 0;
    const reward = timed ? calculateTaskReward(getTaskDurationSeconds(task) / 60) : MINIMUM_TASK_REWARD;
    const schedule = task.repeatDays.length ? "Repeats weekly" : "One-off";
    const detail = done
      ? `${schedule} · ${task.history.length} completed`
      : `${task.group ? `${escapeHtml(task.group)} · ` : ""}${timed ? formatDurationInput(getTaskDurationSeconds(task)) : "No timer"} · +${reward}%`;
    const timerText = task.startedAt
      ? `${formatTime(elapsedMs)} / ${formatTime(requiredMs)}`
      : (timed ? "Not started" : "Ready to complete");

    return `
      <li class="task-item ${done ? "done" : ""}" data-task-id="${task.id}">
        <span class="task-info">
          <strong>${escapeHtml(task.title)}</strong>
          <small>${detail} · <span class="timer-text">${done ? "Finished" : timerText}</span></small>
        </span>
        <span class="task-actions">
          ${!done && timed && !task.startedAt ? `<button class="start-task" type="button">Start Task</button>` : ""}
          ${!done && !timed ? `<button class="complete-task" type="button">Complete</button>` : ""}
          ${!done && task.startedAt ? `<button class="complete-task" type="button" ${timerReady ? "" : "disabled"}>${timerReady ? "Complete" : "Timing…"}</button>` : ""}
          ${done ? `<button class="complete-task" type="button" disabled>✓ Done</button>` : ""}
          <button class="delete-task" type="button" aria-label="Delete ${escapeHtml(task.title)}">×</button>
        </span>
        ${!done && task.startedAt ? `<span class="timer-track"><span class="timer-fill" style="width:${progress}%"></span></span>` : ""}
      </li>`;
  }).join("");

  const openTasks = tasks.filter((task) => !task.completed && task.lastCompletedDay !== localDay()).length;
  document.querySelector("#task-count").textContent = openTasks;
  emptyTasks.hidden = tasks.length > 0;
  emptyTasks.querySelector("p").innerHTML = currentTaskView === "today"
    ? "No quests due today.<br />Enjoy the breathing room."
    : "Your quest patch is empty.<br />Add one small thing above.";
}

function updateTaskTimers() {
  gameState.tasks.forEach((task) => {
    if (!task.startedAt || task.completed) return;
    const item = taskList.querySelector(`[data-task-id="${task.id}"]`);
    if (!item) return;
    const requiredMs = getTaskDurationSeconds(task) * 1000;
    const elapsedMs = Date.now() - new Date(task.startedAt).getTime();
    const ready = elapsedMs >= requiredMs;
    const timerText = item.querySelector(".timer-text");
    const timerFill = item.querySelector(".timer-fill");
    const completeButton = item.querySelector(".complete-task");
    if (timerText) timerText.textContent = `${formatTime(elapsedMs)} / ${formatTime(requiredMs)}`;
    if (timerFill) timerFill.style.width = `${Math.min(100, elapsedMs / requiredMs * 100)}%`;
    if (completeButton) {
      completeButton.disabled = !ready;
      completeButton.textContent = ready ? "Complete" : "Timing…";
    }
  });
}

function renderEgg() {
  const progress = Math.min(99, Math.max(0, gameState.eggProgress));
  document.querySelector("#progress-number").textContent = `${progress}%`;
  document.querySelector("#progress-fill").style.width = `${progress}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", progress);
  const readyCount = gameState.readyEggs.length;
  document.querySelector("#ready-egg-count").textContent = readyCount;
  document.querySelector("#egg-stage").classList.toggle("ready", readyCount > 0);
  hatchButton.disabled = readyCount === 0;
  hatchButton.classList.toggle("ready", readyCount > 0);
  hatchButton.textContent = readyCount > 0 ? `Hatch stored egg (${readyCount}) ✦` : `${100 - progress}% until next egg`;
  document.querySelector("#egg-message").textContent = readyCount > 0
    ? "A ready egg is safely stored. Progress is filling the next one."
    : "Complete timed tasks to help your next Tasker hatch.";
}

function renderStats() {
  const total = gameState.collection.length;
  const unique = new Set(gameState.collection.map((tasker) => tasker.comboKey)).size;
  const duplicates = total - unique;
  document.querySelector("#total-stat").textContent = total;
  document.querySelector("#unique-stat").textContent = unique;
  document.querySelector("#duplicate-stat").textContent = duplicates;
  document.querySelector("#dex-count").textContent = total;
  document.querySelector("#garden-empty").hidden = total > 0;
}

function updateCollectionStats() {
  const total = gameState.collection.length;
  const unique = new Set(gameState.collection.map((tasker) => tasker.comboKey)).size;
  gameState.stats.totalTaskers = total;
  gameState.stats.uniqueCombinations = unique;
  gameState.stats.duplicates = total - unique;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function completeTask(taskId) {
  const task = gameState.tasks.find((item) => item.id === taskId);
  if (!task || task.completed) return;

  const timed = task.taskType === "timed";
  const requiredMs = timed ? getTaskDurationSeconds(task) * 1000 : 0;
  const durationMs = task.startedAt ? Date.now() - new Date(task.startedAt).getTime() : 0;
  if (timed && (!task.startedAt || durationMs < requiredMs)) {
    showToast("This quest needs a little more time first.");
    return;
  }

  let reward = timed ? calculateTaskReward(getTaskDurationSeconds(task) / 60) : MINIMUM_TASK_REWARD;
  let bonusMessage = "";
  if (task.repeatDays.length) {
    const today = localDay();
    if (task.lastCompletedDay === today) return;
    const gap = task.lastCompletedDay ? daysBetween(task.lastCompletedDay, today) : null;
    task.streak = gap === 1 ? (task.streak || 0) + 1 : 1;
    task.lastCompletedDay = today;
    task.startedAt = null;
    if (task.streak % STREAK_BONUS_EVERY === 0) {
      reward += STREAK_BONUS;
      bonusMessage = ` Streak bonus: +${STREAK_BONUS}%!`;
    }
  } else {
    task.completed = true;
    task.completedAt = new Date().toISOString();
    task.startedAt = null;
  }

  task.history.push({
    completedAt: new Date().toISOString(),
    durationMs,
    reward,
  });

  const eggsCreated = addEggProgress(reward);
  gameState.stats.tasksCompleted += 1;
  gameState.stats.lastTaskCompletedAt = new Date().toISOString();
  saveState();
  renderTasks();
  renderEgg();
  applyMood();
  showToast(`Quest complete! +${reward}% progress.${eggsCreated ? ` ${eggsCreated} egg ready!` : ""}${bonusMessage}`);
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) return;
  const taskType = taskForm.querySelector('[name="task-type"]:checked').value;
  const durationSeconds = taskType === "timed" ? parseDurationInput(taskDuration.value) : 0;
  if (taskType === "timed" && !durationSeconds) {
    taskDuration.setCustomValidity?.("Enter a duration such as 1h 20m 30s, 15m, or 45s.");
    taskDuration.reportValidity?.();
    return;
  }
  taskDuration.setCustomValidity?.("");
  const durationMinutes = durationSeconds / 60;
  const repeatDays = [...taskForm.querySelectorAll('[name="repeat-day"]:checked')].map((input) => Number(input.value));
  const typedGroup = taskGroup.value.trim();
  const savedGroup = gameState.groups.find((group) => group.toLowerCase() === typedGroup.toLowerCase());
  const group = savedGroup || typedGroup;
  if (group && !savedGroup) gameState.groups.push(group);
  if (durationSeconds && !BUILT_IN_DURATIONS.includes(durationSeconds) && !gameState.savedDurations.includes(durationSeconds)) {
    gameState.savedDurations.push(durationSeconds);
  }
  if (editingTaskId) {
    const task = gameState.tasks.find((item) => item.id === editingTaskId);
    if (task) {
      const timerChanged = task.taskType !== taskType || getTaskDurationSeconds(task) !== durationSeconds;
      Object.assign(task, { title, group, taskType, repeatDays, repeating: repeatDays.length > 0, durationMinutes, durationSeconds });
      if (timerChanged) task.startedAt = null;
    }
  } else {
    gameState.tasks.unshift({
      id: makeId("task"), title, group, taskType, repeatDays,
      repeating: repeatDays.length > 0,
      completed: false,
      createdAt: new Date().toISOString(),
      streak: 0,
      lastCompletedDay: null,
      durationMinutes, durationSeconds,
      startedAt: null,
      history: [],
    });
  }
  editingTaskId = null;
  saveState();
  renderTasks();
  taskForm.reset();
  updateTaskTypeVisibility();
  questDialog.close();
});

taskList.addEventListener("click", (event) => {
  const taskElement = event.target.closest("[data-task-id]");
  if (!taskElement) return;
  const taskId = taskElement.dataset.taskId;
  if (event.target.closest(".start-task")) {
    const task = gameState.tasks.find((item) => item.id === taskId);
    if (task && !task.startedAt) {
      task.startedAt = new Date().toISOString();
      saveState();
      renderTasks();
    }
    return;
  }
  if (event.target.closest(".complete-task")) {
    completeTask(taskId);
    return;
  }
  if (event.target.closest(".delete-task")) {
    pendingDeleteTaskId = taskId;
    deleteQuestDialog.showModal();
    return;
  }
  showQuestDetails(taskId);
});

function updateTaskTypeVisibility() {
  const taskType = taskForm.querySelector('[name="task-type"]:checked').value;
  durationFieldWrap.hidden = taskType !== "timed";
  if (taskType === "timed" && !taskDuration.value) taskDuration.value = "15m";
}

taskForm.querySelectorAll('[name="task-type"]').forEach((radio) => radio.addEventListener("change", updateTaskTypeVisibility));
updateTaskTypeVisibility();

function renderDurationOptions(filter = "") {
  const choices = [...new Set([...BUILT_IN_DURATIONS, ...gameState.savedDurations])];
  const matching = choices.filter((seconds) => formatDurationInput(seconds).toLowerCase().includes(filter.toLowerCase()));
  durationOptions.innerHTML = matching.length ? matching.map((seconds) => `
    <span class="duration-option" role="option" data-duration-seconds="${seconds}">
      <button class="choose-duration" type="button">${formatDurationInput(seconds)}</button>
      ${BUILT_IN_DURATIONS.includes(seconds) ? "" : `<button class="delete-duration" type="button" aria-label="Delete ${formatDurationInput(seconds)} duration">×</button>`}
    </span>`).join("") : `<span class="no-groups">Type a custom duration such as 45s or 1h 10m</span>`;
}

function positionCustomOptions(input, options) {
  const field = input.getBoundingClientRect();
  const gap = 5;
  const viewportHeight = window.innerHeight || 800;
  const desiredHeight = Math.min(180, options.scrollHeight || 180);
  const roomBelow = viewportHeight - field.bottom - gap - 10;
  const openAbove = roomBelow < Math.min(desiredHeight, 190) && field.top > roomBelow;
  const top = openAbove
    ? Math.max(10, field.top - desiredHeight - gap)
    : field.bottom + gap;
  options.style.left = `${field.left}px`;
  options.style.top = `${top}px`;
  options.style.width = `${field.width}px`;
  options.style.maxHeight = `${Math.min(180, Math.max(100, openAbove ? field.top - gap - 10 : roomBelow))}px`;
}

function openDurationOptions(filter = "") {
  renderDurationOptions(filter);
  if (durationOptions.showPopover) {
    if (!durationOptions.matches(":popover-open")) durationOptions.showPopover();
  } else {
    durationOptions.hidden = false;
  }
  positionCustomOptions(taskDuration, durationOptions);
  taskDuration.setAttribute("aria-expanded", "true");
}

function closeDurationOptions() {
  if (durationOptions.hidePopover) {
    if (durationOptions.matches(":popover-open")) durationOptions.hidePopover();
  } else {
    durationOptions.hidden = true;
  }
  taskDuration.setAttribute("aria-expanded", "false");
}

taskDuration.addEventListener("focus", () => openDurationOptions());
taskDuration.addEventListener("input", () => {
  taskDuration.setCustomValidity?.("");
  openDurationOptions(taskDuration.value);
});
taskDuration.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDurationOptions();
});
taskDuration.addEventListener("blur", () => setTimeout(() => {
  if (!durationMenuPointerActive) closeDurationOptions();
}, 120));
durationOptions.addEventListener("pointerdown", () => {
  durationMenuPointerActive = true;
});
window.addEventListener("pointerup", () => {
  durationMenuPointerActive = false;
});
durationOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-duration-seconds]");
  if (!option) return;
  const seconds = Number(option.dataset.durationSeconds);
  if (event.target.closest(".delete-duration")) {
    gameState.savedDurations = gameState.savedDurations.filter((saved) => saved !== seconds);
    saveState();
    renderDurationOptions(taskDuration.value);
    return;
  }
  if (event.target.closest(".choose-duration")) {
    taskDuration.value = formatDurationInput(seconds);
    taskDuration.setCustomValidity?.("");
    closeDurationOptions();
  }
});

function updateGroupSuggestions() {
  taskGroup.value = "";
  renderGroupOptions();
}

function renderGroupOptions(filter = "") {
  const matchingGroups = gameState.groups.filter((group) =>
    group.toLowerCase().includes(filter.toLowerCase()),
  );
  groupOptions.innerHTML = matchingGroups.length
    ? matchingGroups.map((group) => `
      <span class="group-option" role="option" data-group="${escapeHtml(group)}">
        <button class="choose-group" type="button">${escapeHtml(group)}</button>
        <button class="delete-group" type="button" aria-label="Delete ${escapeHtml(group)} group">×</button>
      </span>`).join("")
    : `<span class="no-groups">${filter ? "Press Add quest to save this new group" : "No saved groups yet"}</span>`;
}

function openGroupOptions() {
  renderGroupOptions(taskGroup.value);
  groupOptions.hidden = false;
  taskGroup.setAttribute("aria-expanded", "true");
}

function closeGroupOptions() {
  groupOptions.hidden = true;
  taskGroup.setAttribute("aria-expanded", "false");
}

taskGroup.addEventListener("focus", openGroupOptions);
taskGroup.addEventListener("input", openGroupOptions);
taskGroup.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeGroupOptions();
});
taskGroup.addEventListener("blur", () => setTimeout(closeGroupOptions, 120));

groupOptions.addEventListener("pointerdown", (event) => event.preventDefault());
groupOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-group]");
  if (!option) return;
  const group = option.dataset.group;
  if (event.target.closest(".delete-group")) {
    gameState.groups = gameState.groups.filter((saved) => saved !== group);
    if (taskGroup.value === group) taskGroup.value = "";
    saveState();
    renderGroupOptions(taskGroup.value);
    return;
  }
  if (event.target.closest(".choose-group")) {
    taskGroup.value = group;
    closeGroupOptions();
  }
});

function openQuestCreator() {
  editingTaskId = null;
  taskForm.reset();
  updateGroupSuggestions();
  taskDuration.value = "15m";
  updateTaskTypeVisibility();
  document.querySelector("#quest-dialog-label").textContent = "NEW QUEST";
  document.querySelector("#quest-dialog-title").textContent = "What needs doing?";
  document.querySelector("#save-quest-button").textContent = "Add to quest list";
  questDialog.showModal();
  taskTitle.focus();
}

function openQuestEditor(taskId) {
  const task = gameState.tasks.find((item) => item.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  taskForm.reset();
  updateGroupSuggestions();
  taskTitle.value = task.title;
  taskGroup.value = task.group || "";
  taskForm.querySelectorAll('[name="repeat-day"]').forEach((input) => {
    input.checked = task.repeatDays.includes(Number(input.value));
  });
  taskForm.querySelectorAll('[name="task-type"]').forEach((input) => {
    input.checked = input.value === task.taskType;
  });
  if (task.taskType === "timed") taskDuration.value = formatDurationInput(getTaskDurationSeconds(task));
  updateTaskTypeVisibility();
  document.querySelector("#quest-dialog-label").textContent = "EDIT QUEST";
  document.querySelector("#quest-dialog-title").textContent = "Adjust this quest";
  document.querySelector("#save-quest-button").textContent = "Save changes";
  questDetailDialog.close();
  questDialog.showModal();
  taskTitle.focus();
}

function showQuestDetails(taskId) {
  const task = gameState.tasks.find((item) => item.id === taskId);
  if (!task) return;
  detailTaskId = taskId;
  const totalDuration = task.history.reduce((total, entry) => total + (entry.durationMs || 0), 0);
  const averageDuration = task.history.length ? totalDuration / task.history.length : 0;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const schedule = task.repeatDays.length ? task.repeatDays.map((day) => days[day]).join(", ") : "One-off";
  document.querySelector("#quest-detail-title").textContent = task.title;
  document.querySelector("#quest-detail-content").innerHTML = `
    <div class="quest-detail-summary">
      <span><strong>${task.history.length}</strong>completed</span>
      <span><strong>${averageDuration ? formatTime(averageDuration) : "—"}</strong>average time</span>
      <span><strong>${escapeHtml(task.group || "None")}</strong>group</span>
    </div>
    <p><strong>Schedule:</strong> ${schedule} · <strong>Type:</strong> ${task.taskType === "timed" ? `${formatDurationInput(getTaskDurationSeconds(task))} timed` : "one-off"}</p>
    ${task.history.length ? `<ul class="history-list">${task.history.slice().reverse().map((entry) => `
      <li><span>${new Date(entry.completedAt).toLocaleString()}</span><strong>${entry.durationMs ? formatTime(entry.durationMs) : "No timer"}</strong></li>`).join("")}</ul>` : `<div class="history-empty">No completions yet. Its story starts here.</div>`}`;
  questDetailDialog.showModal();
}

document.querySelector("#open-quest-dialog").addEventListener("click", openQuestCreator);
document.querySelector("#edit-quest-button").addEventListener("click", () => openQuestEditor(detailTaskId));
document.querySelector(".close-quest-dialog").addEventListener("click", () => questDialog.close());
document.querySelector(".close-detail-dialog").addEventListener("click", () => questDetailDialog.close());
document.querySelector("#cancel-delete-quest").addEventListener("click", () => {
  pendingDeleteTaskId = null;
  deleteQuestDialog.close();
});
document.querySelector("#confirm-delete-quest").addEventListener("click", () => {
  gameState.tasks = gameState.tasks.filter((task) => task.id !== pendingDeleteTaskId);
  pendingDeleteTaskId = null;
  saveState();
  renderTasks();
  deleteQuestDialog.close();
  showToast("Quest removed.");
});

function setTaskView(view) {
  currentTaskView = view;
  const todayTab = document.querySelector("#today-quests-tab");
  const allTab = document.querySelector("#all-quests-tab");
  todayTab.classList.toggle("active", view === "today");
  allTab.classList.toggle("active", view === "all");
  document.querySelector("#quest-view-label").textContent = view === "today" ? "TODAY'S QUESTS" : "ALL QUESTS";
  todayTab.setAttribute("aria-selected", view === "today");
  allTab.setAttribute("aria-selected", view === "all");
  renderTasks();
}
document.querySelector("#today-quests-tab").addEventListener("click", () => setTaskView("today"));
document.querySelector("#all-quests-tab").addEventListener("click", () => setTaskView("all"));

