canvas_size = 1000;
step_size = 20;
field = [];
field_effects = [];
let font;
let do_odd;

chars = [" ", ".", "`", "^", ",", ":", ";", "I", "l", "!", "i", "~", "+", "_", "-", "?", "]", "[", "}", "{", "1", ")", "(", "|", "\\", "/", "t", "f", "j", "r", "x", "n", "u", "v", "c", "z", "X", "Y", "U", "J", "C", "L", "Q", "0", "O", "Z", "m", "w", "q", "p", "d", "b", "k", "h", "a", "o", "*", "#", "M", "W", "&", "8", "%", "B", "@", "█"]

function init_fields() {
  for (let i = 0; i < canvas_size / step_size; i++) {
    field[i] = [];
    field_effects[i] = [];
    for (let j = 0; j < canvas_size / step_size; j++) {
      field[i][j] = 0;
      field_effects[i][j] = 0;
    }
  }
}

function draw_shot(x, y, size) {
  fill('#be0000ff');
  noStroke();
  //ellipse(x * step_size, y * step_size, size * 0.3);
  field_effects[x][y] += size * 40;
}

function shoot() {
  let x = floor(random(canvas_size / step_size));
  let y = floor(random(canvas_size / step_size));
  let hit_size = floor(random(1, 100));

  draw_shot(x, y, hit_size);
  
  if (hit_size < 20) {
    return;
  } else if (hit_size < 75) {
    field[x][y] += 1;
  } else if (hit_size < 94) {
    field[x][y] += 2;
    if (x - 1 >= 0) { field[x - 1][y] += 1; }
    if (x + 1 < canvas_size / step_size) { field[x + 1][y] += 1; }
    if (y - 1 >= 0) { field[x][y - 1] += 1; }
    if (y + 1 < canvas_size / step_size) { field[x][y + 1] += 1; }
  } else {
    field[x][y] += random([12, 20]);
    if (x - 1 >= 0) { field[x - 1][y] += random([5, 8]); }
    if (x + 1 < canvas_size / step_size) { field[x + 1][y] += random([5, 8]); }
    if (y - 1 >= 0) { field[x][y - 1] += random([5, 8]); }
    if (y + 1 < canvas_size / step_size) { field[x][y + 1] += random([5, 8]); }
  }
}

function dissipate_effects() { // AI help here
  let new_effects = [];
  for (let i = 0; i < canvas_size / step_size; i++) {
    new_effects[i] = [];
    for (let j = 0; j < canvas_size / step_size; j++) {
      new_effects[i][j] = field_effects[i][j] * 0.992;
    }
  }

  for (let i = 0; i < canvas_size / step_size; i++) {
    for (let j = 0; j < canvas_size / step_size; j++) {
      let value = field_effects[i][j];
      if (value > 0.5) {
        let spread = value * 0.45; 
        let neighbors = 0;
        if (i - 1 >= 0) neighbors++;
        if (i + 1 < canvas_size / step_size) neighbors++;
        if (j - 1 >= 0) neighbors++;
        if (j + 1 < canvas_size / step_size) neighbors++;
        if (neighbors > 0) {
          let share = spread / neighbors;
          if (i - 1 >= 0) new_effects[i - 1][j] += share;
          if (i + 1 < canvas_size / step_size) new_effects[i + 1][j] += share;
          if (j - 1 >= 0) new_effects[i][j - 1] += share;
          if (j + 1 < canvas_size / step_size) new_effects[i][j + 1] += share;
          new_effects[i][j] -= spread;
        }
      }
    }
  }

  for (let i = 0; i < canvas_size / step_size; i++) {
    for (let j = 0; j < canvas_size / step_size; j++) {
      field_effects[i][j] = new_effects[i][j];
    }
  }
}

function preload() {
  font = loadFont('./Glass_TTY_VT220.ttf');
}

function setup() {
  createCanvas(canvas_size, canvas_size);
  background('#140907ff');
  textFont(font);
  init_fields();
  colorMode(HSL, 100);

  do_odd = true;
}


function draw() {
  background('#14090734');
  textSize(20);
  fill('#33ff00ff');

  dissipate_effects();

  shoot();
  
  let odd = false;
  for (let x = 0; x < canvas_size / step_size; x++) {
    for (let y = 0; y < canvas_size / step_size; y++) {
      fill(noise(x * 0.1, y * 0.1, frameCount * 0.01) * 255);
      fill(map(field_effects[x][y], 0, 250, 0, 15), map(field_effects[x][y], 0, 250, 0, 150), 50);
      text(chars[min(field[x][y], chars.length - 1)], x * step_size + (odd ? step_size / 2 : 0), y * step_size);
      if (do_odd) odd = !odd;
    }
  }
  
}
