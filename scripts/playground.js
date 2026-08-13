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

