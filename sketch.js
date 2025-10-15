canvas_size = 1000;
let agents = [];
moveTypeEnum = {
    RIGID: 'rigid',
    FLEXIBLE: 'flexible'
};

class TailAgent{//spawn agents as head and 'train' behind it of others that just follow the head
    constructor(parent, offset, size, moveType){
        this.parent = parent;
        this.pos = createVector(parent.pos.x + 1, parent.pos.y + 1);
        this.offset = offset;
        this.color = parent.color;
        this.size = size;
        this.moveType = moveType;
    }
    follow() {
        if (this.moveType === moveTypeEnum.RIGID) {
            this.follow_rigid();
        }
        else{
            print('no move type');
        }
    }
    follow_rigid() {
        let parentPos = createVector(this.parent.pos.x, this.parent.pos.y);

        let direction = p5.Vector.sub(this.pos, parentPos);
        
        // Check if the direction vector has magnitude > 0 to avoid division by zero
        if (direction.mag() > 0) {
            direction.normalize();
            direction.mult(this.offset);
            this.pos.set(p5.Vector.add(parentPos, direction));
        } else {
            // If positions are the same, create a small random offset
            let randomOffset = p5.Vector.random2D();
            randomOffset.mult(this.offset);
            this.pos.set(p5.Vector.add(parentPos, randomOffset));
        }
    }
    draw() {
        fill(this.color);
        noStroke();
        color('#ffff')
        circle(this.pos.x, this.pos.y, this.size);
    }

}

class HeadAgent{//spawn agents as head and 'train' behind it of others that just follow the head,
//  spawn based on click and position, with some random stats. implement collisions and damage head
//  touch others tail = eat the rest of the tail. head touch head-> deal damage and bounce off.
//  player puts in food or resources
    constructor(x, y, length, color, moveType){
        this.pos = createVector(x, y);
        this.length = length;
        this.color = color;
        this.moveType = moveType;
        this.tail = [];
        this.size = 13;
        this.create_tail();
        this.vel = 2;
        this.dir = p5.Vector.random2D();

    }
    create_tail(){
        for (let i = 1; i <= this.length; i++) {
            this.tail.push(new TailAgent(this.tail.length < 1 ? this : this.tail[i - 2],
                 this.size , // offset - distance from parent
                  10, // size of the tail segment
                   this.moveType));
        }
    }
    add_tail_segment() {
        let lastSegment = this.tail[this.tail.length - 1];
        this.tail.push(new TailAgent(lastSegment, lastSegment.offset, lastSegment.size - 2, this.moveType));
        this.length++;
    }
    move() {
        this.pos.add(p5.Vector.mult(this.dir, this.vel));

        if (this.pos.x < 0 || this.pos.x > canvas_size) {
            this.dir.x *= -1;
        }
        if (this.pos.y < 0 || this.pos.y > canvas_size) {
            this.dir.y *= -1;
        }
        this.pos.x = constrain(this.pos.x, -1, canvas_size + 1);
        this.pos.y = constrain(this.pos.y, -1, canvas_size + 1);
        for (let segment of this.tail) {
            segment.follow();
        }
    }
    draw() {
        fill(this.color);
        noStroke();
        circle(this.pos.x, this.pos.y, this.size);
        for (let segment of this.tail) {
            segment.draw();
        }
    }
}

function mouseClicked() {
  let newHead = new HeadAgent(mouseX, mouseY, int(random(5, 15)), color(random(100), 80, 60), moveTypeEnum.RIGID);
  agents.push(newHead);
  circle(newHead.pos.x, newHead.pos.y, 20);
}

function mouseDragged() {
    mouseClicked();
}

function setup() {
  createCanvas(canvas_size, canvas_size);
  background('#ff694bff');
  colorMode(HSL, 100);

}


function draw() {
    background('#ff694bff');
    for (let agent of agents) {
        agent.move();
        agent.draw();
    }
  
}
