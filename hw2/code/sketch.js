grid_size = 800;
let balls = [];
let sampler;
let densityField = [];
let densityCells = 40;
let densityCellSize = grid_size / densityCells;
let ballsCount = 100;
let avgColField = [];

class NoiseSampler{
    constructor(scale){
        this.scale = scale;
        this.z = 0;
    }   
    getNoise(x, y){
        return noise(x * this.scale, y * this.scale, frameCount * 0.01);
    }
    getNegativeGradient(x, y){
        let epsilon = 1;
        let n1 = this.getNoise(x + epsilon, y);
        let n2 = this.getNoise(x - epsilon, y);
        let n3 = this.getNoise(x, y + epsilon);
        let n4 = this.getNoise(x, y - epsilon);
        return createVector(n1 - n2, n3 - n4).normalize().mult(-1);
    }
    updateZ(delta){
        this.z += delta;
    }
}

class Ball{
    constructor(x, y, size, col){
        this.pos = createVector(x, y);
        this.size = size;
        this.col = col;
        this.vel = createVector(0, 0);
    }
    draw(){
        fill(this.col);
        noStroke();
        circle(this.pos.x, this.pos.y, this.size);
    }
    update(){
        let force = sampler.getNegativeGradient(this.pos.x, this.pos.y);
        let accel = p5.Vector.mult(force, 0.2);
        this.vel.add(accel);

        this.vel.mult(0.98);

        this.vel.limit(5);

        if (this.pos.x < 0 || this.pos.x > grid_size) {
            this.vel.x *= -1;
            this.pos.x = constrain(this.pos.x, 0, grid_size);
        }
        if (this.pos.y < 0 || this.pos.y > grid_size) {
            this.vel.y *= -1;
            this.pos.y = constrain(this.pos.y, 0, grid_size);
        }
        if (checkCollision(this)){
            this.pos.add(this.vel);
        }
    }
}

function checkCollision(ball){
    for(let other of balls){
        if(other !== ball){
            let distSq = p5.Vector.sub(ball.pos, other.pos).magSq();
            if(distSq < (ball.size/2 + other.size/2) ** 2){
                ball.pos.add(p5.Vector.reflect(ball.vel.copy().normalize(), p5.Vector.sub(ball.pos, other.pos).normalize()).mult(0.9));
                other.pos.add(p5.Vector.reflect(other.vel.copy().normalize(), p5.Vector.sub(other.pos, ball.pos).normalize()).mult(0.9));
                return false;//lol
            }
        }
    }
    return true;
}

function calculateDensityField(){
    for(let x = 0; x < densityCells; x++){
        for(let y = 0; y < densityCells; y++){
            densityField[x][y] = 0;
            avgColField[x][y] = color(0, 0, 100);
            let cellCenterX = x * densityCellSize + densityCellSize / 2;
            let cellCenterY = y * densityCellSize + densityCellSize / 2;
            for(let b of balls){
                let d = dist(cellCenterX, cellCenterY, b.pos.x, b.pos.y);
                densityField[x][y] += max(0, 1 - (d / 100));
                let maxdist = 300;
                if (d < maxdist) {
                    //avgColField[x][y] = lerpColor(avgColField[x][y], b.col, 17000/(d * d));
                    avgColField[x][y] = lerpColor(avgColField[x][y], b.col, map(d, 0, maxdist, 1, 0, true));
                }//bias, balls co su neskor v liste maju vacsiu vahu
            }
        }
    }
}

function drawDensities(){
    noStroke();
    for(let x = 0; x < densityCells; x++){
        for(let y = 0; y < densityCells; y++){
            let density = densityField[x][y];
            if(density > 0.1){
                fill(avgColField[x][y], density);
                push();
                translate(x * densityCellSize + densityCellSize / 2, y * densityCellSize + densityCellSize / 2);
                rotate(sampler.getNoise(x, y) * TWO_PI * 2);
                let rectSize = density * 4;
                rect(0, 0, rectSize, rectSize);
                pop();
            }
        }
    }
}

function setup() {
    createCanvas(grid_size, grid_size);
    sampler = new NoiseSampler(0.001);
    for(let x = 0; x < densityCells; x++){
        densityField[x] = [];
        avgColField[x] = [];
        for(let y = 0; y < densityCells; y++){
            densityField[x][y] = 0;
            avgColField[x][y] = color(0, 0, 0);
        }
    }
    colorMode(HSL, 100);

    let colbanks = [
        [color(0, 100, 99), color(0, 100, 50), color(241, 100, 43)],
        [color(0, 100, 100), color(0, 100, 50), color(60, 100, 10)],
        [color(0, 100, 100), color(20, 100, 50), color(30, 100, 50)],
    ];

    let cols = random(colbanks);
    for(let i = 0; i < ballsCount; i++){
        let b = new Ball(random(grid_size), random(grid_size), 10, random(cols));//color(random(360), 100, 50));
        balls.push(b);
    }
  
}

function draw() {
    background(0);
    sampler.updateZ(10);
    calculateDensityField();
    drawDensities();
    for(let b of balls){
        b.update();
        //b.draw();
    }
}
