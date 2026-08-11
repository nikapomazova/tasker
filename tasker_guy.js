// ---------- Collectible content ----------
// Add future art here. Stable IDs let saved Taskers keep the same appearance.
const PARTS = {
  eyes: [
    { id: "eyes-sprout", path: "images/eyes/IMG_9846.PNG", rarity: "common", weight: 70 },
    { id: "eyes-dreamer", path: "images/eyes/IMG_9848.PNG", rarity: "rare", weight: 30 },
  ],
  bodies: [
    { id: "body-bean", path: "images/body/IMG_9849.PNG", rarity: "uncommon", weight: 100 },
  ],
  arms: [
    { id: "arms-noodle", path: "images/arms/IMG_9853.PNG", rarity: "common", weight: 100 },
  ],
  legs: [
    { id: "legs-puddle", path: "images/legs/IMG_9852.PNG", rarity: "common", weight: 100 },
  ],
  accessories: [
    { id: "accessory-none", path: null, rarity: "common", weight: 65 },
    { id: "accessory-glasses", path: "images/accessories/IMG_9847.PNG", rarity: "epic", weight: 35 },
  ],
};

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3 };
const STORAGE_KEY = "tasker-garden-state-v1";
const SAVE_VERSION = 2;
const TASK_PROGRESS_PER_MINUTE = 1;
const MINIMUM_TASK_REWARD = 5;
const STREAK_BONUS_EVERY = 3;
const STREAK_BONUS = 10;
const MERGE_ACCESSORY_CHANCE = 0.2;
const GRAVITY = 1050;
const MAX_FALL_SPEED = 900;
const JUMP_STRENGTH = 470;
const DROP_REACTION_HEIGHT_MULTIPLIER = 1.5;
const DROP_REACTION_DURATION = 1800;
const DROP_EYES_PATH = "images/eyes/animations/drop_eyes.png";

const playground = document.querySelector("#playground");
const characterTemplate = document.querySelector("#character-template");
const taskForm = document.querySelector("#task-form");
const taskTitle = document.querySelector("#task-title");
const taskRepeating = document.querySelector("#task-repeating");
const taskDuration = document.querySelector("#task-duration");
const customDuration = document.querySelector("#custom-duration");
const customDurationWrap = document.querySelector("#custom-duration-wrap");
const taskList = document.querySelector("#task-list");
const emptyTasks = document.querySelector("#empty-tasks");
const hatchButton = document.querySelector("#hatch-button");
const hatchDialog = document.querySelector("#hatch-dialog");
const taskerdexDialog = document.querySelector("#taskerdex-dialog");
const mergeDialog = document.querySelector("#merge-dialog");
const platformLayer = document.querySelector("#platform-layer");
const prefersLessMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const movingCharacters = [];

function defaultState() {
  return {
    version: SAVE_VERSION,
    tasks: [],
    eggProgress: 0,
    readyEggs: [],
    platforms: [],
    collection: [],
    stats: {
      tasksCompleted: 0,
      lastTaskCompletedAt: null,
      totalTaskers: 0,
      uniqueCombinations: 0,
      duplicates: 0,
    },
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.tasks) || !Array.isArray(saved.collection)) {
      return defaultState();
    }
    const migrated = {
      ...defaultState(),
      ...saved,
      stats: { ...defaultState().stats, ...saved.stats },
    };
    migrated.version = SAVE_VERSION;
    migrated.readyEggs = Array.isArray(saved.readyEggs) ? saved.readyEggs : [];
    migrated.platforms = Array.isArray(saved.platforms) ? saved.platforms : [];
    migrated.tasks = saved.tasks.map((task) => ({
      durationMinutes: task.durationMinutes ?? 5,
      startedAt: task.startedAt || null,
      ...task,
    }));
    while (migrated.eggProgress >= 100) {
      migrated.readyEggs.push({ id: makeId("egg"), readyAt: new Date().toISOString() });
      migrated.eggProgress -= 100;
    }
    return migrated;
  } catch (error) {
    console.warn("Tasker save data could not be read. Starting a fresh garden.", error);
    return defaultState();
  }
}

let gameState = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedRandom(items) {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function smoothStep(progress) {
  const clamped = Math.max(0, Math.min(progress, 1));
  return clamped * clamped * (3 - 2 * clamped);
}

// one minute is one progress %
function calculateTaskReward(durationMinutes) {
  return Math.max(MINIMUM_TASK_REWARD, Math.round(durationMinutes * TASK_PROGRESS_PER_MINUTE));
}

function addEggProgress(amount) {
  gameState.eggProgress += amount;
  let eggsCreated = 0;
  while (gameState.eggProgress >= 100) {
    gameState.eggProgress -= 100;
    gameState.readyEggs.push({ id: makeId("egg"), readyAt: new Date().toISOString() });
    eggsCreated += 1;
  }
  return eggsCreated;
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(dayA, dayB) {
  const first = new Date(`${dayA}T12:00:00`);
  const second = new Date(`${dayB}T12:00:00`);
  return Math.round((second - first) / 86400000);
}

function escapeHtml(value) {
  const temporary = document.createElement("div");
  temporary.textContent = value;
  return temporary.innerHTML;
}

function findPart(category, id) {
  return PARTS[category].find((part) => part.id === id) || PARTS[category][0];
}

function getCombinationKey(parts) {
  return [
    parts.eyes,
    parts.body,
    parts.leftArm,
    parts.rightArm,
    parts.leftLeg,
    parts.rightLeg,
    parts.accessory,
  ].join("|");
}

function getTaskerRarity(parts) {
  const selected = [
    findPart("eyes", parts.eyes),
    findPart("bodies", parts.body),
    findPart("arms", parts.leftArm),
    findPart("arms", parts.rightArm),
    findPart("legs", parts.leftLeg),
    findPart("legs", parts.rightLeg),
    findPart("accessories", parts.accessory),
  ];
  return selected.reduce((highest, part) =>
    RARITY_RANK[part.rarity] > RARITY_RANK[highest] ? part.rarity : highest,
  "common");
}

function createRandomTasker() {
  const parts = {
    eyes: weightedRandom(PARTS.eyes).id,
    body: weightedRandom(PARTS.bodies).id,
    leftArm: weightedRandom(PARTS.arms).id,
    rightArm: weightedRandom(PARTS.arms).id,
    leftLeg: weightedRandom(PARTS.legs).id,
    rightLeg: weightedRandom(PARTS.legs).id,
    accessory: weightedRandom(PARTS.accessories).id,
  };
  const comboKey = getCombinationKey(parts);
  const previousCopies = gameState.collection.filter((tasker) => tasker.comboKey === comboKey).length;
  const beginnings = ["Mopsy", "Bibble", "Tumble", "Wobble", "Pip", "Noodle", "Bumble", "Doodle"];
  const endings = ["bean", "bop", "kins", "crumb", "bug", "loop", "pop", "bit"];

  return {
    id: makeId("tasker"),
    name: `${randomItem(beginnings)}${randomItem(endings)}`,
    parts,
    comboKey,
    rarity: getTaskerRarity(parts),
    hatchedAt: new Date().toISOString(),
    isFirstDiscovery: previousCopies === 0,
    copyNumber: previousCopies + 1,
  };
}

function getMood() {
  const lastCompletion = gameState.stats.lastTaskCompletedAt;
  if (!lastCompletion) return "sleepy";
  const hoursSince = (Date.now() - new Date(lastCompletion).getTime()) / 3600000;
  if (hoursSince < 36) return "happy";
  if (hoursSince < 96) return "sleepy";
  return "neglected";
}

function applyMood() {
  const mood = getMood();
  const pill = document.querySelector("#wellbeing-pill");
  const text = document.querySelector("#wellbeing-text");
  pill.classList.remove("happy", "sleepy", "neglected");
  pill.classList.add(mood);

  const messages = {
    happy: "Your Taskers feel bright and bouncy",
    sleepy: "Your Taskers are getting sleepy",
    neglected: "Your Taskers miss you—but they recover",
  };
  text.textContent = messages[mood];

  movingCharacters.forEach((character) => character.setMood(mood));
}

// tasks and egg progress
function renderTasks() {
  taskList.innerHTML = gameState.tasks.map((task) => {
    const completedToday = task.repeating && task.lastCompletedDay === localDay();
    const done = task.completed || completedToday;
    const requiredMs = task.durationMinutes * 60000;
    const elapsedMs = task.startedAt
      ? Math.min(requiredMs, Date.now() - new Date(task.startedAt).getTime())
      : 0;
    const timerReady = elapsedMs >= requiredMs;
    const progress = task.startedAt ? Math.min(100, elapsedMs / requiredMs * 100) : 0;
    const reward = calculateTaskReward(task.durationMinutes);
    const detail = done
      ? (task.repeating ? `Daily · ${task.streak || 0} day streak` : "Quest complete")
      : `${task.durationMinutes} min · +${reward}% · ${task.repeating ? `${task.streak || 0} day streak` : "one-time"}`;
    const timerText = task.startedAt
      ? `${formatTime(elapsedMs)} / ${formatTime(requiredMs)}`
      : "Not started";

    return `
      <li class="task-item ${done ? "done" : ""}" data-task-id="${task.id}">
        <span class="task-info">
          <strong>${escapeHtml(task.title)}</strong>
          <small>${detail} · <span class="timer-text">${done ? "Finished" : timerText}</span></small>
        </span>
        <span class="task-actions">
          ${!done && !task.startedAt ? `<button class="start-task" type="button">Start Task</button>` : ""}
          ${!done && task.startedAt ? `<button class="complete-task" type="button" ${timerReady ? "" : "disabled"}>${timerReady ? "Complete" : "Timing…"}</button>` : ""}
          ${done ? `<button class="complete-task" type="button" disabled>✓ Done</button>` : ""}
          <button class="delete-task" type="button" aria-label="Delete ${escapeHtml(task.title)}">×</button>
        </span>
        ${!done && task.startedAt ? `<span class="timer-track"><span class="timer-fill" style="width:${progress}%"></span></span>` : ""}
      </li>`;
  }).join("");

  const openTasks = gameState.tasks.filter((task) => !task.completed).length;
  document.querySelector("#task-count").textContent = openTasks;
  emptyTasks.hidden = gameState.tasks.length > 0;
}

function updateTaskTimers() {
  gameState.tasks.forEach((task) => {
    if (!task.startedAt || task.completed) return;
    const item = taskList.querySelector(`[data-task-id="${task.id}"]`);
    if (!item) return;
    const requiredMs = task.durationMinutes * 60000;
    const elapsedMs = Math.min(requiredMs, Date.now() - new Date(task.startedAt).getTime());
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

  const requiredMs = task.durationMinutes * 60000;
  if (!task.startedAt || Date.now() - new Date(task.startedAt).getTime() < requiredMs) {
    showToast("This quest needs a little more time first.");
    return;
  }

  let reward = calculateTaskReward(task.durationMinutes);
  let bonusMessage = "";
  if (task.repeating) {
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
  const durationMinutes = taskDuration.value === "custom"
    ? Math.max(1, Number(customDuration.value) || 1)
    : Number(taskDuration.value);
  gameState.tasks.unshift({
    id: makeId("task"),
    title,
    repeating: taskRepeating.checked,
    completed: false,
    createdAt: new Date().toISOString(),
    streak: 0,
    lastCompletedDay: null,
    durationMinutes,
    startedAt: null,
  });
  saveState();
  renderTasks();
  taskForm.reset();
  customDurationWrap.hidden = true;
  taskTitle.focus();
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
  }
  if (event.target.closest(".complete-task")) completeTask(taskId);
  if (event.target.closest(".delete-task")) {
    gameState.tasks = gameState.tasks.filter((task) => task.id !== taskId);
    saveState();
    renderTasks();
    showToast("Quest removed.");
  }
});

taskDuration.addEventListener("change", () => {
  customDurationWrap.hidden = taskDuration.value !== "custom";
});

// tasker previews and collection
function fillTaskerParts(container, specimen) {
  const sources = {
    eyes: findPart("eyes", specimen.parts.eyes).path,
    body: findPart("bodies", specimen.parts.body).path,
    "left-arm": findPart("arms", specimen.parts.leftArm).path,
    "right-arm": findPart("arms", specimen.parts.rightArm).path,
    "left-leg": findPart("legs", specimen.parts.leftLeg).path,
    "right-leg": findPart("legs", specimen.parts.rightLeg).path,
    accessory: findPart("accessories", specimen.parts.accessory).path,
  };

  Object.entries(sources).forEach(([className, source]) => {
    const image = container.querySelector(`.${className}`);
    image.src = source || "";
    image.hidden = !source;
  });
}

function createStaticPreview(specimen) {
  const preview = document.createElement("div");
  preview.className = "tasker-preview";
  preview.innerHTML = `
    <img class="part limb leg left-leg" alt="" />
    <img class="part limb leg right-leg" alt="" />
    <img class="part limb arm left-arm" alt="" />
    <img class="part limb arm right-arm" alt="" />
    <img class="part body" alt="" />
    <img class="part eyes" alt="" />
    <img class="part accessory" alt="" />`;
  fillTaskerParts(preview, specimen);
  return preview;
}

function renderTaskerdex() {
  const grid = document.querySelector("#dex-grid");
  const empty = document.querySelector("#dex-empty");
  grid.innerHTML = "";

  const groups = new Map();
  gameState.collection.forEach((tasker) => {
    if (!groups.has(tasker.comboKey)) groups.set(tasker.comboKey, []);
    groups.get(tasker.comboKey).push(tasker);
  });

  [...groups.values()].reverse().forEach((copies) => {
    const tasker = copies[copies.length - 1];
    const card = document.createElement("article");
    card.className = `tasker-card ${tasker.isFirstDiscovery ? "new-combo" : ""}`;
    card.dataset.comboKey = tasker.comboKey;
    card.append(createStaticPreview(tasker));
    const date = new Date(tasker.hatchedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    card.insertAdjacentHTML("beforeend", `
      <span class="card-rarity">${tasker.rarity}</span>
      <h3>${escapeHtml(tasker.name)}</h3>
      <p>Discovered ${date}</p>
      <div class="tasker-card-footer">
        <span class="duplicate-badge">Owned ×${copies.length}</span>
        ${copies.length >= 3 ? `<button class="merge-button" type="button">Merge 3</button>` : ""}
      </div>`);
    grid.append(card);
  });

  const total = gameState.collection.length;
  const unique = new Set(gameState.collection.map((tasker) => tasker.comboKey)).size;
  document.querySelector("#dex-stats").innerHTML = `
    <div class="dex-stat"><strong>${total}</strong>Total Taskers</div>
    <div class="dex-stat"><strong>${unique}</strong>Unique combinations</div>
    <div class="dex-stat"><strong>${total - unique}</strong>Duplicates</div>`;
  empty.hidden = total > 0;
}

function removeMovingTaskers(ids) {
  for (let index = movingCharacters.length - 1; index >= 0; index -= 1) {
    if (ids.includes(movingCharacters[index].specimen.id)) {
      movingCharacters[index].element.remove();
      movingCharacters.splice(index, 1);
    }
  }
}

function mergeTaskers(comboKey) {
  const copies = gameState.collection.filter((tasker) => tasker.comboKey === comboKey);
  if (copies.length < 3) return;
  const consumed = copies.slice(0, 3);
  const consumedIds = consumed.map((tasker) => tasker.id);
  const base = consumed[0];
  const parts = { ...base.parts };
  let gainedAccessory = false;

  const accessoryChoices = PARTS.accessories.filter((part) =>
    part.path && part.id !== parts.accessory,
  );
  if (accessoryChoices.length && Math.random() < MERGE_ACCESSORY_CHANCE) {
    parts.accessory = weightedRandom(accessoryChoices).id;
    gainedAccessory = true;
  }

  gameState.collection = gameState.collection.filter((tasker) => !consumedIds.includes(tasker.id));
  const newComboKey = getCombinationKey(parts);
  const previousCopies = gameState.collection.filter((tasker) => tasker.comboKey === newComboKey).length;
  const merged = {
    ...base,
    id: makeId("tasker"),
    name: `${base.name} ✦`,
    parts,
    comboKey: newComboKey,
    rarity: getTaskerRarity(parts),
    hatchedAt: new Date().toISOString(),
    isFirstDiscovery: previousCopies === 0,
    copyNumber: previousCopies + 1,
    mergedFrom: consumedIds,
  };
  gameState.collection.push(merged);
  removeMovingTaskers(consumedIds);
  movingCharacters.push(new MovingCharacter(merged, performance.now()));
  updateCollectionStats();
  saveState();
  renderStats();
  renderTaskerdex();

  const preview = document.querySelector("#merge-preview");
  preview.innerHTML = "";
  preview.append(createStaticPreview(merged));
  document.querySelector("#merge-description").textContent = gainedAccessory
    ? "The merge shimmered and revealed a different accessory!"
    : "The three matching Taskers combined into one extra-sparkly friend.";
  mergeDialog.showModal();
}

document.querySelector("#dex-grid").addEventListener("click", (event) => {
  const button = event.target.closest(".merge-button");
  if (!button) return;
  mergeTaskers(button.closest("[data-combo-key]").dataset.comboKey);
});

function showHatchReveal(tasker) {
  const preview = document.querySelector("#reveal-preview");
  preview.innerHTML = "";
  preview.append(createStaticPreview(tasker));
  document.querySelector("#hatch-title").textContent = `${tasker.name} hatched!`;

  const label = document.querySelector("#discovery-label");
  label.classList.toggle("duplicate", !tasker.isFirstDiscovery);
  label.textContent = tasker.isFirstDiscovery ? "✦ NEW COMBINATION!" : `FAMILIAR FRIEND · COPY ${tasker.copyNumber}`;
  document.querySelector("#hatch-description").textContent = tasker.isFirstDiscovery
    ? "A never-before-seen mix has joined your garden and entered the Taskerdex."
    : "You found this exact combination again. Duplicates are counted and always welcome.";

  const selectedParts = [
    findPart("eyes", tasker.parts.eyes),
    findPart("bodies", tasker.parts.body),
    findPart("arms", tasker.parts.leftArm),
    findPart("legs", tasker.parts.leftLeg),
    findPart("accessories", tasker.parts.accessory),
  ];
  document.querySelector("#rarity-row").innerHTML = selectedParts
    .filter((part) => part.path)
    .map((part) => `<span class="rarity-chip ${part.rarity}">${part.rarity} · ${part.id.split("-").slice(1).join(" ")}</span>`)
    .join("");
  hatchDialog.showModal();
}

hatchButton.addEventListener("click", () => {
  if (gameState.readyEggs.length === 0) return;
  const tasker = createRandomTasker();
  gameState.collection.push(tasker);
  gameState.readyEggs.shift();
  updateCollectionStats();
  saveState();
  movingCharacters.push(new MovingCharacter(tasker, performance.now()));
  renderEgg();
  renderStats();
  renderTaskerdex();
  showHatchReveal(tasker);
});

document.querySelector("#close-hatch").addEventListener("click", () => hatchDialog.close());
document.querySelector("#open-taskerdex").addEventListener("click", () => {
  renderTaskerdex();
  taskerdexDialog.showModal();
});
document.querySelector("#close-taskerdex").addEventListener("click", () => taskerdexDialog.close());
document.querySelector("#close-merge").addEventListener("click", () => mergeDialog.close());

// drawn platforms
function renderPlatforms() {
  const bounds = playground.getBoundingClientRect();
  platformLayer.innerHTML = "";
  gameState.platforms.forEach((platform) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", platform.x1 * bounds.width);
    line.setAttribute("y1", platform.y1 * bounds.height);
    line.setAttribute("x2", platform.x2 * bounds.width);
    line.setAttribute("y2", platform.y2 * bounds.height);
    platformLayer.append(line);
  });
}

let drawingMode = false;
let drawingStart = null;
let previewLine = null;

document.querySelector("#toggle-draw").addEventListener("click", () => {
  drawingMode = !drawingMode;
  playground.classList.toggle("drawing", drawingMode);
  document.querySelector(".draw-tools").classList.toggle("drawing", drawingMode);
  document.querySelector("#toggle-draw").classList.toggle("active", drawingMode);
  document.querySelector("#toggle-draw").setAttribute("aria-pressed", drawingMode);
});

platformLayer.addEventListener("pointerdown", (event) => {
  if (!drawingMode) return;
  const bounds = playground.getBoundingClientRect();
  drawingStart = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  previewLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  previewLine.setAttribute("x1", drawingStart.x);
  previewLine.setAttribute("y1", drawingStart.y);
  previewLine.setAttribute("x2", drawingStart.x);
  previewLine.setAttribute("y2", drawingStart.y);
  platformLayer.append(previewLine);
  platformLayer.setPointerCapture(event.pointerId);
});

platformLayer.addEventListener("pointermove", (event) => {
  if (!previewLine) return;
  const bounds = playground.getBoundingClientRect();
  previewLine.setAttribute("x2", event.clientX - bounds.left);
  previewLine.setAttribute("y2", event.clientY - bounds.top);
});

function finishPlatform(event) {
  if (!previewLine || !drawingStart) return;
  const bounds = playground.getBoundingClientRect();
  const end = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  if (Math.hypot(end.x - drawingStart.x, end.y - drawingStart.y) >= 24) {
    gameState.platforms.push({
      id: makeId("platform"),
      x1: drawingStart.x / bounds.width,
      y1: drawingStart.y / bounds.height,
      x2: end.x / bounds.width,
      y2: end.y / bounds.height,
    });
    saveState();
  }
  drawingStart = null;
  previewLine = null;
  renderPlatforms();
}
platformLayer.addEventListener("pointerup", finishPlatform);
platformLayer.addEventListener("pointercancel", finishPlatform);

document.querySelector("#clear-platforms").addEventListener("click", () => {
  gameState.platforms = [];
  saveState();
  renderPlatforms();
});

// gravity movement
class MovingCharacter {
  constructor(specimen, currentTime) {
    this.specimen = specimen;
    this.element = characterTemplate.content.firstElementChild.cloneNode(true);
    playground.append(this.element);
    fillTaskerParts(this.element, specimen);
    this.element.classList.add("is-visible");
    this.facing = 1;
    this.behavior = "stopped";
    this.behaviorStartedAt = currentTime;
    this.nextBehaviorAt = currentTime;
    this.targetSpeed = 0;

    const world = this.getWorldSize();
    this.physics = new TaskerPhysics({
      getWorldSize: () => this.getWorldSize(),
      getPlatforms: () => gameState.platforms,
      gravity: GRAVITY,
      maxFallSpeed: MAX_FALL_SPEED,
      x: Math.random() * Math.max(0, world.width - world.size),
      y: 0,
      onLand: (fallDistance) => this.handleLanding(fallDistance),
    });
    this.physics.y = world.height - world.size * 0.91;
    this.physics.grounded = true;
    this.setMood(getMood());
    this.addDragging();
    this.chooseBehavior(currentTime);
  }

  getWorldSize() {
    const bounds = playground.getBoundingClientRect();
    // offsetWidth stays constant when the tasker rotates to match a slope.
    const size = this.element.offsetWidth || this.element.getBoundingClientRect().width;
    return { width: bounds.width, height: bounds.height, size };
  }

  setMood(mood) {
    this.element.classList.remove("mood-happy", "mood-sleepy", "mood-neglected");
    this.element.classList.add(`mood-${mood}`);
  }

  setBehavior(name) {
    this.behavior = name;
    this.element.classList.remove("is-stopped", "is-walking", "is-running", "is-jumping", "is-falling");
    this.element.classList.add(`is-${name}`);
  }

  chooseBehavior(currentTime) {
    this.behaviorStartedAt = currentTime;
    if (!this.physics.grounded) {
      this.setBehavior("falling");
      this.nextBehaviorAt = currentTime + 250;
      return;
    }

    const choice = Math.random();
    if (choice < 0.25) {
      this.setBehavior("stopped");
      this.physics.vx = 0;
      this.targetSpeed = 0;
      this.nextBehaviorAt = currentTime + randomBetween(600, 1800);
    } else if (choice < 0.8) {
      const running = choice >= 0.55;
      this.setBehavior(running ? "running" : "walking");
      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.targetSpeed = (running ? randomBetween(90, 145) : randomBetween(35, 65)) * this.facing;
      this.physics.vx = 0;
      this.nextBehaviorAt = currentTime + (running ? randomBetween(700, 1600) : randomBetween(1400, 3000));
    } else {
      this.setBehavior("jumping");
      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.physics.vx = randomItem([0, randomBetween(35, 65), randomBetween(90, 145)]) * this.facing;
      this.physics.jump(JUMP_STRENGTH * randomBetween(0.85, 1.1));
      this.nextBehaviorAt = currentTime + randomBetween(750, 1200);
    }
  }

  addDragging() {
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;
    this.element.addEventListener("pointerdown", (event) => {
      if (drawingMode) return;
      pointerId = event.pointerId;
      const bounds = playground.getBoundingClientRect();
      offsetX = event.clientX - bounds.left - this.physics.x;
      offsetY = event.clientY - bounds.top - this.physics.y;
      this.physics.beginDrag();
      this.setBehavior("stopped");
      this.element.classList.add("dragging");
      this.element.setPointerCapture(pointerId);
      event.preventDefault();
    });
    this.element.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId || !this.physics.dragging) return;
      const bounds = playground.getBoundingClientRect();
      this.physics.dragTo(event.clientX - bounds.left - offsetX, event.clientY - bounds.top - offsetY);
    });
    const release = (event) => {
      if (event.pointerId !== pointerId || !this.physics.dragging) return;
      this.physics.release();
      this.element.classList.remove("dragging");
      this.setBehavior("falling");
      this.nextBehaviorAt = performance.now() + 300;
      pointerId = null;
    };
    this.element.addEventListener("pointerup", release);
    this.element.addEventListener("pointercancel", release);
  }

  handleLanding(fallDistance) {
    const { size } = this.getWorldSize();
    if (fallDistance > size * DROP_REACTION_HEIGHT_MULTIPLIER) this.showDropReaction();
    this.nextBehaviorAt = performance.now() + 180;
  }

  showDropReaction() {
    const eyes = this.element.querySelector(".eyes");
    const normalEyes = eyes.src;
    const loader = new Image();
    loader.onload = () => {
      eyes.src = DROP_EYES_PATH;
      setTimeout(() => { if (eyes.isConnected) eyes.src = normalEyes; }, DROP_REACTION_DURATION);
    };
    loader.onerror = () => {};
    loader.src = DROP_EYES_PATH;
  }

  update(currentTime, elapsedSeconds) {
    if (this.physics.dragging) {
      this.render();
      return;
    }
    if (!prefersLessMotion.matches && currentTime >= this.nextBehaviorAt) this.chooseBehavior(currentTime);
    if (this.behavior === "walking" || this.behavior === "running") {
      const duration = this.nextBehaviorAt - this.behaviorStartedAt;
      const progress = (currentTime - this.behaviorStartedAt) / duration;
      this.physics.vx = this.targetSpeed * Math.min(smoothStep(progress / 0.22), smoothStep((1 - progress) / 0.22));
    }
    this.physics.step(prefersLessMotion.matches ? 0 : elapsedSeconds);
    if (!this.physics.grounded && this.behavior !== "jumping") this.setBehavior("falling");
    this.render();
  }

  render() {
    this.element.style.transform = `translate3d(${this.physics.x}px, ${this.physics.y}px, 0) rotate(${this.physics.surfaceAngle}deg) scaleX(${this.facing})`;
  }
}

// the starting point
updateCollectionStats();
saveState();
gameState.collection.forEach((tasker) => {
  movingCharacters.push(new MovingCharacter(tasker, performance.now()));
});
renderTasks();
renderEgg();
renderStats();
renderTaskerdex();
applyMood();
renderPlatforms();

let previousTime = performance.now();
function animateCharacters(currentTime) {
  const elapsedSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
  movingCharacters.forEach((character) => character.update(currentTime, elapsedSeconds));
  previousTime = currentTime;
  requestAnimationFrame(animateCharacters);
}
requestAnimationFrame(animateCharacters);

// moods update gradually while the page stays open; completing a task updates immediately.
setInterval(applyMood, 60000);
setInterval(() => {
  updateTaskTimers();
}, 1000);

window.addEventListener("resize", renderPlatforms);
