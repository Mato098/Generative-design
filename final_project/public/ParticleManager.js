// ParticleManager.js
// Simple manager for updating and drawing particles
import { Particle, FireballEffector } from './ParticleBase.js';

export class ParticleManager {
  constructor() {
    this.particles = [];
    this.buffer = createGraphics(window.LAYOUT.totalWidth, window.LAYOUT.totalHeight);
    this.buffer.clear();
    this.buffer.blendMode(BLEND);
    this.isClear = true;
    this.lastParticleTime = 0;

    this.automataResult = [];
    this.automataSize = 800;
    this.automataFill();

}

  spawn(particle) {
    this.particles.push(particle);
    this.isClear = false;
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.isAlive()) {
        p.update(dt);
      }
    }
    // Remove dead particles
    this.particles = this.particles.filter(p => p.isAlive());
    if (this.particles.length > 0) this.lastParticleTime = millis();
    if (!this.isClear && this.particles.length === 0 && millis() - this.lastParticleTime > 500) {
      this.isClear = true;
      this.buffer.clear();
    }
  }

  draw() {
    this.buffer.push();
    this.buffer.drawingContext.globalCompositeOperation = "destination-out";
    this.buffer.fill(0, 0, 0, 30); // controls fade speed
    this.buffer.rect(0, 0, this.buffer.width, this.buffer.height);
    this.buffer.drawingContext.globalCompositeOperation = "source-over";
    this.buffer.pop();
    
    for (const p of this.particles) {
      if (p.isAlive()) {
        p.draw(this.buffer);
      }
    }

    image(this.buffer, 0, 0);
  }

  addEffectorToAll(effector) {
    for (const p of this.particles) {
        p.effectors.push(effector);
    }
  }

  spawnBurst(position, count, color, effectors=[], size=1.2, lifetime=1.0, speedBase=20, blendMode=BLEND) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 20 + speedBase;
      const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      };
      // Support both single color and array of colors
      let particleColor = color;
      if (Array.isArray(color)) {
        particleColor = color[i % color.length];
      }
      const particle = new Particle({
        position: { ...position },
        velocity: velocity,
        color: particleColor,
        size: size,
        lifetime: lifetime * (0.5 + Math.random() * 0.5),
        colBlendMode: blendMode
      });
      for (const effector of effectors) {
        particle.effectors.push(effector);
      }
      this.spawn(particle);
    }
}
  spawnFountain(position, amount, color, angleRange, angleBase, speedRange, effectors=[]) {
    console.log('Spawning fountain at', position, 'amount:', amount, 'color:', color, 'angleRange:', angleRange, 'angleBase:', angleBase, 'speedRange:', speedRange, 'effectors:', effectors);
    for (let i = 0; i < amount; i++) {
        const angle = angleBase + (Math.random() * angleRange - angleRange / 2);
        const speed = Math.random() * (speedRange.max - speedRange.min) + speedRange.min;
        const velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        const particle = new Particle({
            position: { ...position },
            velocity: velocity,
            color: color,
            size: 1,
            lifetime: 0.5
        });
        for (const effector of effectors) {
          particle.effectors.push(effector);
        }
        this.spawn(particle);
    }
  }

  spawnFireball(position, color, lifetime=10, effectors = []) {
    const particle = new Particle({
        position: { ...position },
        velocity: { x: 0, y: 0 },
        color: color,
        size: 20,
        lifetime: lifetime
    });
    for (const effector of effectors) {
      particle.effectors.push(effector);
    }
    this.spawn(particle);
  }

  moveFireball(position){
    for (const p of this.particles) {
      if (p.effectors.length > 0 && p.effectors[0] instanceof FireballEffector) {
        console.log('Moving fireball to', position);
        p.effectors[0].position.x = position.x;
        p.effectors[0].position.y = position.y;
      }
    }
  }

  spawnAutomataLine(position, color, lifetime=1){
    //get line from automata
    let automataX = this.automataSize / 2;
    let automataY = 0;
    let stepSize = 3;
    while (automataY < this.automataSize){
        let chosenDirection = this.automataStepChoiceautomata(automataX, automataY);
        if (chosenDirection == null) break;
        automataX += chosenDirection.x;
        automataY += chosenDirection.y;
        let drawX = position.x + (automataX - this.automataSize / 2) * stepSize;
        let drawY = position.y +  - automataY * stepSize;
        const particle = new Particle({

            position: { x: drawX, y: drawY },
            velocity: { x: (Math.random() - 0.5) * 10, y: -20 },
            color: color,
            size: 3,
            lifetime: lifetime * (0.5 + Math.random() * 0.5),
            colBlendMode: ADD
        });
        this.spawn(particle);
    }
  }

  automataStepChoiceautomata(automataX, automataY) {
        let possibleDirections = [];
        if (this.automataResult[automataY + 1] == 1) possibleDirections.push(createVector(0, 1)); //down
        if (this.automataResult[automataY + 1][automataX - 1] == 1) possibleDirections.push(createVector(-1, 1)); //down-left
        if (this.automataResult[automataY + 1][automataX + 1] == 1) possibleDirections.push(createVector(1, 1)); //down-right
        if (this.automataResult[automataY][automataX - 1] == 1) possibleDirections.push(createVector(-1, 0)); //left
        if (this.automataResult[automataY][automataX + 1] == 1) possibleDirections.push(createVector(1, 0)); //right
        if (possibleDirections.length > 0){ 
            return random(possibleDirections);
        }else{
            return null;
        }
  }
    
  clear() {
    this.particles = [];
    this.isClear = true;
    this.buffer.clear();
  }

  automataFill() {
    for (let i=0; i < this.automataSize; i++) {
        this.automataResult[i] = [];
        for (let j=0; j < this.automataSize; j++) {
            this.automataResult[i][j] = 0;
        }
    }
    this.automataResult[0][Math.floor(this.automataSize/2)] = 1;
    for (let rowIdx = 1; rowIdx < this.automataSize; rowIdx++)        
    for (let colIdx = 1; colIdx < this.automataSize - 1; colIdx++) {
        let left = this.automataResult[rowIdx - 1][colIdx - 1];
        let center = this.automataResult[rowIdx - 1][colIdx];
        let right = this.automataResult[rowIdx - 1][colIdx + 1];

        //rule 86
        if (left === 1 && center === 1 && right === 1) this.automataResult[rowIdx][colIdx] = 0;
        if (left === 1 && center === 1 && right === 0) this.automataResult[rowIdx][colIdx] = 1;
        if (left === 1 && center === 0 && right === 1) this.automataResult[rowIdx][colIdx] = 0;
        if (left === 1 && center === 0 && right === 0) this.automataResult[rowIdx][colIdx] = 1;
        if (left === 0 && center === 1 && right === 1) this.automataResult[rowIdx][colIdx] = 0;
        if (left === 0 && center === 1 && right === 0) this.automataResult[rowIdx][colIdx] = 1;
        if (left === 0 && center === 0 && right === 1) this.automataResult[rowIdx][colIdx] = 1;
        if (left === 0 && center === 0 && right === 0) this.automataResult[rowIdx][colIdx] = 0;
    }
}
}
