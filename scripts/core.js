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
const BUILT_IN_DURATIONS = [30, 60, 300, 600, 900, 1800, 2700, 3600, 7200];

const playground = document.querySelector("#playground");
const characterTemplate = document.querySelector("#character-template");
const taskForm = document.querySelector("#task-form");
const taskTitle = document.querySelector("#task-title");
const taskGroup = document.querySelector("#task-group");
const groupOptions = document.querySelector("#group-options");
const taskDuration = document.querySelector("#task-duration");
const durationOptions = document.querySelector("#duration-options");
const durationFieldWrap = document.querySelector("#duration-field-wrap");
const taskList = document.querySelector("#task-list");
const emptyTasks = document.querySelector("#empty-tasks");
const hatchButton = document.querySelector("#hatch-button");
const hatchDialog = document.querySelector("#hatch-dialog");
const taskerdexDialog = document.querySelector("#taskerdex-dialog");
const mergeDialog = document.querySelector("#merge-dialog");
const questDialog = document.querySelector("#quest-dialog");
const questDetailDialog = document.querySelector("#quest-detail-dialog");
const deleteQuestDialog = document.querySelector("#delete-quest-dialog");
const platformLayer = document.querySelector("#platform-layer");
const prefersLessMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const movingCharacters = [];
let currentTaskView = "today";
let pendingDeleteTaskId = null;
let editingTaskId = null;
let detailTaskId = null;
let durationMenuPointerActive = false;

function defaultState() {
  return {
    version: SAVE_VERSION,
    tasks: [],
    groups: [],
    savedDurations: [],
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
    migrated.tasks = saved.tasks.map((task) => {
      const history = Array.isArray(task.history) ? task.history : [];
      if (!history.length && task.completedAt) {
        history.push({ completedAt: task.completedAt, durationMs: (task.durationMinutes || 0) * 60000 });
      }
      return {
        ...task,
        durationMinutes: task.durationMinutes ?? 5,
        durationSeconds: task.durationSeconds ?? Math.round((task.durationMinutes ?? 5) * 60),
        startedAt: task.startedAt || null,
        taskType: task.taskType || "timed",
        group: task.group || "",
        repeatDays: Array.isArray(task.repeatDays) ? task.repeatDays : (task.repeating ? [0,1,2,3,4,5,6] : []),
        history,
      };
    });
    migrated.groups = Array.isArray(saved.groups)
      ? saved.groups
      : [...new Set(migrated.tasks.map((task) => task.group).filter(Boolean))];
    migrated.savedDurations = Array.isArray(saved.savedDurations) ? saved.savedDurations : [];
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

function getTaskDurationSeconds(task) {
  return task.durationSeconds ?? Math.round((task.durationMinutes || 0) * 60);
}

function formatDurationInput(totalSeconds) {
  let remaining = Math.max(1, Math.round(totalSeconds));
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return [hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`].filter(Boolean).join(" ");
}

function parseDurationInput(value) {
  const text = value.trim().toLowerCase();
  if (!text) return 0;
  // A bare number is treated as minutes, which keeps quick custom entry convenient.
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text) * 60);
  if (/^\d{1,3}:\d{1,2}(?::\d{1,2})?$/.test(text)) {
    const parts = text.split(":").map(Number);
    const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
    if (minutes >= 60 || seconds >= 60) return 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  let total = 0;
  let matchedText = "";
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/g)) {
    const amount = Number(match[1]);
    const unit = match[2][0];
    total += amount * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
    matchedText += match[0];
  }
  const leftovers = text.replace(/(\d+(?:\.\d+)?)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/g, "").replace(/\s/g, "");
  return matchedText && !leftovers ? Math.round(total) : 0;
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

