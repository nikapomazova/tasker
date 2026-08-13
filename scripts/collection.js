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

