// Lightweight 2D platform physics. This file knows nothing about Tasker images.
(function () {
  class TaskerPhysics {
    constructor(options) {
      this.getWorldSize = options.getWorldSize;
      this.getPlatforms = options.getPlatforms;
      this.gravity = options.gravity;
      this.maxFallSpeed = options.maxFallSpeed;
      this.onLand = options.onLand || (() => {});
      this.x = options.x || 0;
      this.y = options.y || 0;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.dragging = false;
      this.surfaceAngle = 0;
      this.releaseStartY = null;
    }

    getBody() {
      const { width, height, size } = this.getWorldSize();
      return {
        width,
        height,
        size,
        footOffset: size * 0.91,
        headOffset: size * 0.18,
      };
    }

    platformPixels(platform, world) {
      return {
        id: platform.id,
        x1: platform.x1 * world.width,
        y1: platform.y1 * world.height,
        x2: platform.x2 * world.width,
        y2: platform.y2 * world.height,
      };
    }

    lineYAt(platform, x) {
      const dx = platform.x2 - platform.x1;
      if (Math.abs(dx) < 1) return null;
      const left = Math.min(platform.x1, platform.x2) - 2;
      const right = Math.max(platform.x1, platform.x2) + 2;
      if (x < left || x > right) return null;
      const progress = (x - platform.x1) / dx;
      return platform.y1 + (platform.y2 - platform.y1) * progress;
    }

    standablePlatforms(world) {
      return this.getPlatforms()
        .map((platform) => this.platformPixels(platform, world))
        .filter((platform) => {
          const dx = Math.abs(platform.x2 - platform.x1);
          const dy = Math.abs(platform.y2 - platform.y1);
          return dx >= 24 && dy / dx <= TaskerPhysics.MAX_STANDABLE_SLOPE;
        });
    }

    platformAngle(platform) {
      let angle = Math.atan2(platform.y2 - platform.y1, platform.x2 - platform.x1) * 180 / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      return angle;
    }

    findSupport(centerX, footY, tolerance, world) {
      let best = { id: "ground", y: world.height, angle: 0 };
      for (const platform of this.standablePlatforms(world)) {
        const y = this.lineYAt(platform, centerX);
        if (y === null || Math.abs(y - footY) > tolerance) continue;
        if (Math.abs(y - footY) < Math.abs(best.y - footY)) {
          best = {
            id: platform.id,
            y,
            angle: this.platformAngle(platform),
          };
        }
      }
      return Math.abs(best.y - footY) <= tolerance ? best : null;
    }

    resolveVertical(previousY, nextY, world) {
      const centerX = this.x + world.size / 2;
      const platforms = this.standablePlatforms(world);
      const previousFoot = previousY + world.footOffset;
      const nextFoot = nextY + world.footOffset;
      const previousHead = previousY + world.headOffset;
      const nextHead = nextY + world.headOffset;

      if (this.vy >= 0) {
        const landings = [{ id: "ground", y: world.height, angle: 0 }];
        for (const platform of platforms) {
          const y = this.lineYAt(platform, centerX);
          if (y !== null) {
            landings.push({
              id: platform.id,
              y,
              angle: this.platformAngle(platform),
            });
          }
        }
        const landing = landings
          .filter((surface) => surface.id === "ground"
            ? nextFoot >= surface.y
            : previousFoot <= surface.y + 2 && nextFoot >= surface.y)
          .sort((a, b) => a.y - b.y)[0];
        if (landing) {
          const landingY = landing.y - world.footOffset;
          const fallDistance = this.releaseStartY === null ? 0 : Math.max(0, landingY - this.releaseStartY);
          this.y = landingY;
          this.vy = 0;
          this.grounded = true;
          this.surfaceAngle = landing.angle;
          if (this.releaseStartY !== null) this.onLand(fallDistance);
          this.releaseStartY = null;
          return;
        }
      } else {
        const ceilings = platforms
          .map((platform) => ({ platform, y: this.lineYAt(platform, centerX) }))
          .filter(({ y }) => y !== null && previousHead >= y && nextHead <= y)
          .sort((a, b) => b.y - a.y);
        if (ceilings.length) {
          this.y = ceilings[0].y - world.headOffset + 2;
          this.vy = 0;
          this.grounded = false;
          return;
        }
      }
      this.y = nextY;
    }

    resolveWallCollision(previousX, nextX, world) {
      const top = this.y + world.headOffset;
      const bottom = this.y + world.footOffset;
      for (const saved of this.getPlatforms()) {
        const platform = this.platformPixels(saved, world);
        const dx = Math.abs(platform.x2 - platform.x1);
        const dy = Math.abs(platform.y2 - platform.y1);
        if (dy < dx * 1.5) continue;
        const wallX = (platform.x1 + platform.x2) / 2;
        const wallTop = Math.min(platform.y1, platform.y2);
        const wallBottom = Math.max(platform.y1, platform.y2);
        if (bottom < wallTop || top > wallBottom) continue;
        const previousRight = previousX + world.size * 0.78;
        const nextRight = nextX + world.size * 0.78;
        const previousLeft = previousX + world.size * 0.22;
        const nextLeft = nextX + world.size * 0.22;
        if (previousRight <= wallX && nextRight >= wallX) {
          this.vx = 0;
          return wallX - world.size * 0.78;
        }
        if (previousLeft >= wallX && nextLeft <= wallX) {
          this.vx = 0;
          return wallX - world.size * 0.22;
        }
      }
      return nextX;
    }

    step(elapsedSeconds) {
      if (this.dragging) return;
      const world = this.getBody();
      const previousX = this.x;
      let nextX = Math.max(0, Math.min(world.width - world.size, this.x + this.vx * elapsedSeconds));
      nextX = this.resolveWallCollision(previousX, nextX, world);
      this.x = nextX;

      if (this.grounded) {
        const support = this.findSupport(this.x + world.size / 2, this.y + world.footOffset, 18, world);
        if (support) {
          this.y = support.y - world.footOffset;
          this.vy = 0;
          this.surfaceAngle = support.angle;
          return;
        }
        this.grounded = false;
        this.surfaceAngle = 0;
      }

      this.vy = Math.min(this.maxFallSpeed, this.vy + this.gravity * elapsedSeconds);
      this.resolveVertical(this.y, this.y + this.vy * elapsedSeconds, world);
    }

    jump(strength) {
      if (!this.grounded || this.dragging) return false;
      this.grounded = false;
      this.vy = -strength;
      return true;
    }

    beginDrag() {
      this.dragging = true;
      this.grounded = false;
      this.vx = 0;
      this.vy = 0;
      this.surfaceAngle = 0;
    }

    dragTo(x, y) {
      const world = this.getBody();
      this.x = Math.max(-world.size * 0.2, Math.min(world.width - world.size * 0.8, x));
      this.y = Math.max(-world.size * 0.2, Math.min(world.height - world.footOffset, y));
    }

    release() {
      this.dragging = false;
      this.releaseStartY = this.y;
      this.vx = 0;
      this.vy = 0;
    }
  }

  TaskerPhysics.MAX_STANDABLE_SLOPE = 1.2;
  window.TaskerPhysics = TaskerPhysics;
}());
