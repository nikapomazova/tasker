const pictures = {
  eyes: ["images/eyes/IMG_9846.PNG", "images/eyes/IMG_9848.PNG"],
  body: ["images/body/IMG_9849.PNG"],
  arms: ["images/arms/IMG_9853.PNG"],
  legs: ["images/legs/IMG_9852.PNG"],
  accessories: ["images/accessories/IMG_9847.PNG"],
};

const minimumJumpHeight = 0.14;
const maximumJumpHeight = 0.42;
const playground = document.querySelector("#playground");
const characterTemplate = document.querySelector("#character-template");
const createButton = document.querySelector("#create-character");
const prefersLessMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const characters = [];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function smoothStep(progress) {
  const clamped = Math.max(0, Math.min(progress, 1));
  return clamped * clamped * (3 - 2 * clamped);
}

class MovingCharacter {
  constructor(currentTime) {
    this.element = characterTemplate.content.firstElementChild.cloneNode(true);
    playground.append(this.element);
    this.setRandomPictures();
    this.element.classList.add("is-visible");

    this.pathPosition = Math.random() * this.getPathLength();
    this.velocity = 0;
    this.targetVelocity = 0;
    this.facing = 1;
    this.behavior = "stopped";
    this.behaviorStartedAt = currentTime;
    this.nextBehaviorAt = currentTime;
    this.jumpStartedAt = 0;
    this.jumpDuration = 900;
    this.jumpHeight = 60;
    this.chooseBehavior(currentTime);
  }

  setPart(partName, source) {
    const part = this.element.querySelector(`.${partName}`);
    part.src = source || "";
    part.hidden = !source;
  }

  setRandomPictures() {
    this.setPart("eyes", randomItem(pictures.eyes));
    this.setPart("body", randomItem(pictures.body));
    this.setPart("left-arm", randomItem(pictures.arms));
    this.setPart("right-arm", randomItem(pictures.arms));
    this.setPart("left-leg", randomItem(pictures.legs));
    this.setPart("right-leg", randomItem(pictures.legs));

    const accessory = Math.random() < 0.5
      ? randomItem(pictures.accessories)
      : null;
    this.setPart("accessory", accessory);
  }

  getMeasurements() {
    const bounds = playground.getBoundingClientRect();
    const size = this.element.getBoundingClientRect().width;
    return {
      width: Math.max(0, bounds.width - size),
      height: Math.max(0, bounds.height - size),
      size,
    };
  }

  getPathLength() {
    const { width, height } = this.getMeasurements();
    return Math.max(1, 2 * (width + height));
  }

  chooseBehavior(currentTime) {
    const choice = Math.random();
    this.behaviorStartedAt = currentTime;

    if (choice < 0.25) {
      this.behavior = "stopped";
      this.velocity = 0;
      this.targetVelocity = 0;
      this.nextBehaviorAt = currentTime + randomBetween(100, 1000);
    } else if (choice < 0.8) {
      this.behavior = choice < 0.55 ? "walking" : "running";
      const speed = this.behavior === "walking"
        ? randomBetween(45, 80)
        : randomBetween(130, 210);

      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.targetVelocity = speed * this.facing;
      this.velocity = 0;
      this.nextBehaviorAt = currentTime + (this.behavior === "walking"
        ? randomBetween(1000, 2000)
        : randomBetween(300, 1000));
    } else {
      this.behavior = "jumping";
      this.jumpStartedAt = currentTime;
      this.jumpDuration = randomBetween(650, 1150);

      const { size } = this.getMeasurements();
      this.jumpHeight = randomBetween(
        size * minimumJumpHeight,
        size * maximumJumpHeight,
      );

      const jumpMovement = randomItem(["still", "slow", "fast"]);
      const jumpSpeed = jumpMovement === "still"
        ? 0
        : jumpMovement === "slow"
          ? randomBetween(45, 80)
          : randomBetween(130, 210);

      if (jumpSpeed > 0) {
        this.facing = Math.random() < 0.5 ? -1 : 1;
      }
      this.velocity = jumpSpeed * this.facing;
      this.targetVelocity = this.velocity;
      this.nextBehaviorAt = currentTime + this.jumpDuration;
    }

    this.element.classList.remove(
      "is-stopped",
      "is-walking",
      "is-running",
      "is-jumping",
    );
    this.element.classList.add(`is-${this.behavior}`);
  }

  getSurfacePosition(jumpOffset) {
    const { width, height, size } = this.getMeasurements();
    const pathLength = Math.max(1, 2 * (width + height));
    const position = ((this.pathPosition % pathLength) + pathLength) % pathLength;
    const imagePadding = size * 0.09;

    if (position <= width) {
      return {
        x: position,
        y: height + imagePadding - jumpOffset,
        rotation: 0,
      };
    }

    if (position <= width + height) {
      return {
        x: width + imagePadding - jumpOffset,
        y: height - (position - width),
        rotation: -90,
      };
    }

    if (position <= width * 2 + height) {
      return {
        x: width - (position - width - height),
        y: -imagePadding + jumpOffset,
        rotation: 180,
      };
    }

    return {
      x: -imagePadding + jumpOffset,
      y: position - width * 2 - height,
      rotation: 90,
    };
  }

  update(currentTime, elapsedSeconds) {
    if (!prefersLessMotion.matches && currentTime >= this.nextBehaviorAt) {
      this.chooseBehavior(currentTime);
    }

    if (!prefersLessMotion.matches) {
      if (this.behavior === "walking" || this.behavior === "running") {
        const duration = this.nextBehaviorAt - this.behaviorStartedAt;
        const progress = (currentTime - this.behaviorStartedAt) / duration;
        const acceleration = smoothStep(progress / 0.22);
        const deceleration = smoothStep((1 - progress) / 0.22);
        this.velocity = this.targetVelocity * Math.min(acceleration, deceleration);
      }
      this.pathPosition += this.velocity * elapsedSeconds;
    }

    let jumpOffset = 0;
    if (!prefersLessMotion.matches && this.behavior === "jumping") {
      const progress = Math.min(
        (currentTime - this.jumpStartedAt) / this.jumpDuration,
        1,
      );
      jumpOffset = 4 * this.jumpHeight * progress * (1 - progress);
    } else if (!prefersLessMotion.matches && this.behavior === "running") {
      jumpOffset = Math.abs(Math.sin(currentTime / 85)) * 5;
    } else if (!prefersLessMotion.matches && this.behavior === "walking") {
      jumpOffset = Math.abs(Math.sin(currentTime / 190)) * 2;
    }

    const position = this.getSurfacePosition(jumpOffset);
    this.element.style.transform =
      `translate3d(${position.x}px, ${position.y}px, 0) ` +
      `rotate(${position.rotation}deg) scaleX(${this.facing})`;
  }
}

createButton.addEventListener("click", () => {
  characters.push(new MovingCharacter(performance.now()));
});

let previousTime = performance.now();

function animateCharacters(currentTime) {
  const elapsedSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
  characters.forEach((character) => character.update(currentTime, elapsedSeconds));
  previousTime = currentTime;
  requestAnimationFrame(animateCharacters);
}

requestAnimationFrame(animateCharacters);
