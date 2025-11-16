canvas_size = 800;
let agents = [];
let automataResult = [];
let automataSize = 800;

class StrokeAgent {
    constructor(x, y, angle, color, stepSize = 3) {
        this.initPosition = createVector(x, y);
        this.initAngle = angle;
        this.automataX = automataSize / 2;
        this.automataY = 0;
        this.stepSize = stepSize;
        this.originalColor = color;
        this.color = color;
        this.lifeTime = 0;
        this.lifetimeMax = automataSize/2;
    }

    update(){
        let possibleDirections = [];
        if (automataResult[this.automataY + 1] == 1) possibleDirections.push(createVector(0, 1)); //down
        if (automataResult[this.automataY + 1][this.automataX - 1] == 1) possibleDirections.push(createVector(-1, 1)); //down-left
        if (automataResult[this.automataY + 1][this.automataX + 1] == 1) possibleDirections.push(createVector(1, 1)); //down-right
        if (automataResult[this.automataY][this.automataX - 1] == 1) possibleDirections.push(createVector(-1, 0)); //left
        if (automataResult[this.automataY][this.automataX + 1] == 1) possibleDirections.push(createVector(1, 0)); //right

        if (possibleDirections.length > 0 && this.lifeTime < this.lifetimeMax){ 
            let chosenDirection = random(possibleDirections);
            this.automataX += chosenDirection.x;
            this.automataY += chosenDirection.y;
        }else{
            agents.splice(agents.indexOf(this), 1);//destroy agent
            return;
        }
        this.color = color(hue(this.color), saturation(this.color), map(this.lifeTime, 0, this.lifetimeMax, 10, 80), map(this.lifeTime, 0, this.lifetimeMax, 0.3, 0.9));
        this.lifeTime++;
        if (random() < 0.01){
            this.lifeTime += this.lifetimeMax / 5;
            //spawn new agent
            let newAgent = new StrokeAgent(this.initPosition.x, this.initPosition.y, this.initAngle, this.originalColor, this.stepSize);
            newAgent.automataX = this.automataX;
            newAgent.automataY = this.automataY;
            agents.push(newAgent);
        }
        if (random() < 0.01){
            this.lifeTime = this.lifetimeMax; //kill agent
        }
    }

    draw(){
        push();
        translate(this.initPosition.x, this.initPosition.y);
        rotate(this.initAngle);
        let drawX = (this.automataX - automataSize / 2) * this.stepSize;
        let drawY = this.automataY * this.stepSize;
        fill(this.color);
        circle(drawX, drawY, this.stepSize);
        pop();
    }
}

function mouseDragged(){
    let dragDirection = createVector(mouseX - pmouseX, mouseY - pmouseY);
    let dragMag = dragDirection.mag();
    dragDirection.normalize();
    let angle = atan2(dragDirection.y, dragDirection.x) - PI / 2;
    let newAgent = new StrokeAgent(mouseX, mouseY, angle, color(map(dragMag, 0, 30, 60, -90), 100, 50, 0.2), 2);
    agents.push(newAgent);
}

function automataFill() {
    for (let rowIdx = 1; rowIdx < automataSize; rowIdx++)        
    for (let colIdx = 1; colIdx < automataSize - 1; colIdx++) {
        let left = automataResult[rowIdx - 1][colIdx - 1];
        let center = automataResult[rowIdx - 1][colIdx];
        let right = automataResult[rowIdx - 1][colIdx + 1];

        //rule 86
        if (left === 1 && center === 1 && right === 1) automataResult[rowIdx][colIdx] = 0;
        if (left === 1 && center === 1 && right === 0) automataResult[rowIdx][colIdx] = 1;
        if (left === 1 && center === 0 && right === 1) automataResult[rowIdx][colIdx] = 0;
        if (left === 1 && center === 0 && right === 0) automataResult[rowIdx][colIdx] = 1;
        if (left === 0 && center === 1 && right === 1) automataResult[rowIdx][colIdx] = 0;
        if (left === 0 && center === 1 && right === 0) automataResult[rowIdx][colIdx] = 1;
        if (left === 0 && center === 0 && right === 1) automataResult[rowIdx][colIdx] = 1;
        if (left === 0 && center === 0 && right === 0) automataResult[rowIdx][colIdx] = 0;
    }
}

function setup() {
    createCanvas(canvas_size, canvas_size);
    rectMode(CENTER);
    noStroke();
    colorMode(HSL);

    for (let i=0; i < automataSize; i++) {
        automataResult[i] = [];
        for (let j=0; j < automataSize; j++) {
            automataResult[i][j] = 0;
        }
    }
    automataResult[0][Math.floor(automataSize/2)] = 1; //initial condition
    automataFill();

    background(0);

}

function draw() {
    //background(0);
    for (let agent of agents) {
        agent.update();
        agent.draw();
    }
    print(agents.length);
}
