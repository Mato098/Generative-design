
let seed;
let init_color;

function get_rand_x() {
  let increment = width * 0.04;
  let x = noise(random(seed)) * width;
  x -= x % increment;
  console.log(x);
  return x;
}

function get_rand_y() {
  let increment = height * 0.04;
  let y = noise(random(seed)) * height;
  y -= y % increment;
  return y;
}

function pretty_circle(x, y, d, l_shift = 0) {
  colorMode(HSL);
  let base_color = color((init_color + frameCount * 0.1) - y * 0.1, map(sin(x * 0.1 + frameCount * 0.002), -1, 1, 20, 90), 17 + l_shift, 1);
  fill(base_color);
  stroke('#191d17ff');
  
  circle(x, y, d);
}


function setup() {
  createCanvas(1000, 1000);
  seed = 1;
  noiseSeed(seed);
  //noLoop();
  init_color = random(360);
  
}


function draw() {
  background(0);
  let step = 60 + sin(frameCount * 0.02) * 0.4; //breathe
  for (let i = -10; i < width + 50; i += step) {
    for (let j = -10; j < height + 50; j += step) {
      let offset = noise(i * 0.01, j * 0.01, frameCount * 0.001) * step * 1.3;

      //strokeWeight(2);
      strokeWeight(6);
      pretty_circle(i + offset, j + offset, step * 2);
      //pretty_circle(i, j, step * 2);
      
      strokeWeight(0);
      for (let k = 1; k < 5; k++) {
        //pretty_circle(i + offset, j + offset, step * 2 - k * (step * 0.15), k);
      }
    }
  }

}

function mousePressed() {
  seed += 1;
  noiseSeed(seed);
  init_color = random(360);
  redraw();
}
