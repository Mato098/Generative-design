canvas_size = 800;
cell_count = 50;
cell_size = canvas_size / cell_count;

let resourceEnum = {
    WOOD: 'wood',
    STONE: 'stone'
};

class Unit {
    constructor(type, x, y, color, hp) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.color = color;
        this.hp = hp;
    }
}

class WorkerUnit extends Unit {
    constructor(x, y, color) {
        super('worker', x, y, color, 20);
        this.carryCapacity = 10;
        this.currentLoad = 0;
        this.carryResource = null;
    }
}

class Building {
    constructor(type, x, y, color) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.color = color;
    }
}

class MainBuilding extends Building {
    constructor(x, y, color) {
        super('main', x, y, color);
        this.hp = 300;
    }
}

class WorkerBuilding extends Building {
    constructor(x, y, color) {
        super('worker', x, y, color);
        this.hp = 200;
        this.maxCapacity = 5;
        this.housedUnits = [];
    }
    spawnWorker() {
        if (this.housedUnits.length < this.maxCapacity) {
            const worker = new WorkerUnit(this.x, this.y, this.color);
            this.housedUnits.push(worker);
            return true;
        }
        return false;
    }
}

class Kingdom {
    constructor(color, x, y) {
        this.color = color;
        this.x = x;
        this.y = y;
        this.money = 100;
        this.workerCount = 0;
        this.soldierCount = 0;
    }
}

function setup() {
    createCanvas(canvas_size, canvas_size);

}

function draw() {
    background(0);
}
