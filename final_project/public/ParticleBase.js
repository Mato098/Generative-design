// ParticleBase.js
// Base classes for particles and effectors for visual effects

export class Particle {
  constructor({
    position = { x: 0, y: 0 },
    velocity = { x: 0, y: 0 },
    color = [255, 0, 0, 255], // RGBA
    size = 4,
    lifetime = 1.0,
    effectors = [],
    colBlendMode = BLEND
  } = {}) {
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.color = color;
    this.size = size;
    this.lifetime = lifetime;
    this.age = 0;
    this.effectors = effectors; // Array of Effector instances
    this.alive = true;
    this.colBlendMode = colBlendMode;
  }

  update(dt) {
    // Apply effectors
    for (const effector of this.effectors) {
      effector.applyTo(this, dt);
    }
    // Integrate motion
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.age += dt;
    if (this.age >= this.lifetime) {
      this.alive = false;
    }
  }

  draw(buffer) {
    buffer.push();
    buffer.noStroke();
    this.color.setAlpha(150);
    buffer.fill(this.color);
    buffer.rectMode(CENTER);
    buffer.blendMode(this.colBlendMode);
    buffer.rect(this.position.x, this.position.y, this.size, this.size);
    buffer.pop();
  }

  isAlive() {
    return this.alive;
  }
}

export class Effector {
  // Override this in subclasses
  applyTo(particle, dt) {
    // Example: gravity, wind, etc.
  }
}

export class GravityEffector extends Effector {
  constructor(gravity = { x: 0, y: 100 }) {
    super();
    this.gravity = gravity;
  }
    applyTo(particle, dt) {
    particle.velocity.x += this.gravity.x * dt;
    particle.velocity.y += this.gravity.y * dt;
  } 
}

export class DragEffector extends Effector {
  constructor(dragCoefficient = 0.1) {
    super();
    this.dragCoefficient = dragCoefficient;
  }
    applyTo(particle, dt) {
    particle.velocity.x -= particle.velocity.x * this.dragCoefficient * dt;
    particle.velocity.y -= particle.velocity.y * this.dragCoefficient * dt;
  }
}

export class FireballEffector extends Effector {
  constructor(center = { x: 0, y: 0 }) {
    super();
    this.center = center;

    this.radius = 300;         // influence area
    this.pull = 0.45;          // soft attraction
    this.spin = 1.2;           // tangential curl
    this.noise = 9.9;          // chaotic turbulence
    this.damping = 0.78;       // stabilizes high velocities
    this.maxDist = 320;        // hard clamp
  }

  applyTo(particle, dt) {
    const dx = this.center.x - particle.position.x;
    const dy = this.center.y - particle.position.y;

    const distSq = dx*dx + dy*dy;
    const dist = Math.sqrt(distSq) + 0.0001;

    const nx = dx / dist;
    const ny = dy / dist;

    // --------------------------------------------
    // 1. DAMPING: essential to avoid runaway chaos
    // --------------------------------------------
    particle.velocity.x *= this.damping;
    particle.velocity.y *= this.damping;

    // ------------------------------------------------------------------
    // 2. SOFT ATTRACTION: proportional, not inverse-square (no blowups)
    // ------------------------------------------------------------------
    const t = Math.max(0, 1 - dist / this.radius);
    particle.velocity.x += nx * this.pull * t * dt * 60;
    particle.velocity.y += ny * this.pull * t * dt * 60;

    // -----------------------------------------------------
    // 3. CURL SPIN: gives chaotic swirling, not a circle
    // -----------------------------------------------------
    const px = -ny;   // perpendicular x
    const py = nx;    // perpendicular y

    // stronger toward center, but not enough to lock into orbit
    const curl = this.spin * t * (0.3 + Math.random() * 0.7);
    particle.velocity.x += px * curl * dt * 60;
    particle.velocity.y += py * curl * dt * 60;

    // ------------------------------------------------------
    // 4. CHAOTIC NOISE: like 2D curl noise, but lightweight
    // ------------------------------------------------------
    particle.velocity.x += (Math.random() - 0.5) * this.noise;
    particle.velocity.y += (Math.random() - 0.5) * this.noise;

    // ----------------------------------------------------
    // 5. DISTANCE CLAMP: prevents explosion when moving center
    // ----------------------------------------------------
    if (dist > this.maxDist) {
      particle.position.x = this.center.x - nx * this.maxDist;
      particle.position.y = this.center.y - ny * this.maxDist;
      // no velocity correction – letting it keep momentum looks better
    }
  }
}