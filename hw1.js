canvas_size = 1440;
grid_count = 50;
cell_size = canvas_size / grid_count;
let col1, col2, lin, bg;
let colorbank1 = ['#cc8c01ff', '#000e36ff', '#3d1d0aff', '#14051dff'];

let colorbank2 = ['#ffc1c1ff', '#2b2811ff', '#423d06ff', '#071412ff'];

let colorbank3 = ['#f25f5cff', '#ffe066ff', '#f86c1cff', '#08d3d3ff'];

let colorbank4 = ['#0d4f53ff', '#d5ffb2ff', '#4a6b0dff', '#001616ff'];

let colorbank5 = ['#dbffffff', '#61b191ff', '#ecfffbff', '#fddbe8ff'];

let colorbanks = [colorbank1, colorbank2, colorbank3, colorbank4, colorbank5];





function incline_tile(x, y){// /
    let fill_lines_count = 25;
    let size = cell_size;

    push();
    translate(x, y);

    for (let i = 0; i < fill_lines_count; i++) {
        let inter = map(i, 0, fill_lines_count, 0, size);
        stroke(lerpColor(col1, col2, i / fill_lines_count));
        line(-size / 2, size / 2 + inter, size / 2, -size / 2 + inter);
    }
    pop();
}

function decline_tile(x, y){// \
    let fill_lines_count = 25;
    let size = cell_size;

    push();
    translate(x, y);

    for (let i = 0; i < fill_lines_count; i++) {
        let inter = map(i, 0, fill_lines_count, 0, size);
        stroke(lerpColor(col1, col2, i / fill_lines_count));
        line(-size / 2, -size / 2 + inter, size / 2, size / 2 + inter);
    }
    pop();
}

function vertical_tile(x, y, above_heading, under_not_rendered){
    let fill_lines_count = 25;
    let size = cell_size;

    push();
    translate(x, y);
    let tile_above_is_slanted = Math.abs(above_heading.dot(createVector(1, 1))) < 0.0001 || Math.abs(above_heading.dot(createVector(1, -1))) < 0.0001;

    for (let i = 0; i < fill_lines_count / 2; i++) {//left part
        let inter = map(i, 0, fill_lines_count, 0, size * 0.7 );
        stroke(lerpColor(col1, col2, i / fill_lines_count * 1.3));
        line(-inter, 0, -inter * (tile_above_is_slanted ? 0.4 : 1), -size + (tile_above_is_slanted ? inter : 0));//upper half, watch out for incline/decline
        line(-inter, size * (under_not_rendered ? 0.4 : 1.2), -inter, 0);//lower half
    }
    for (let i = 0; i < fill_lines_count / 2; i++) {//right part
        let inter = map(i, 0, fill_lines_count, 0, size * 0.7);
        stroke(lerpColor(col1, col2, i / fill_lines_count * 1.3));
        line(inter, 0, inter * (tile_above_is_slanted ? 0.4 : 1), -size + (tile_above_is_slanted ? inter : 0));//upper half, watch out for incline/decline
        line(inter, size * (under_not_rendered ? 0.4 : 1.2), inter, 0);//lower half
    }
    pop();
}

function horizontal_tile(x, y){
    let fill_lines_count = 40;
    let size = cell_size;

    push();
    translate(x, y);

    for (let i = 0; i < fill_lines_count - 2; i++) {// -2 = avoid cutting into slanted tiles
        let inter = map(i, 0, fill_lines_count, 0, size);
        stroke(lerpColor(col1, col2, i / fill_lines_count));
        line(-size / 2, -size / 2 + inter, size / 2, -size / 2 + inter);
    }
    pop();
}



function setup() {// 2560x1440(intended), actual 7680x4320 lol
    createCanvas(canvas_size * 1.77778, canvas_size);
    colorMode(HSL);

    let colbank_used = random([0,1,2,3,4]);
    //colbank_used = 4;

    col1 = color(colorbanks[colbank_used][0]);
    col2 = color(colorbanks[colbank_used][1]);
    lin = color(colorbanks[colbank_used][2]);
    bg = color(colorbanks[colbank_used][3]);
    
    frameRate(1);
    
    noLoop();
}

function draw() {
    background(bg);

    let cutoff_magnitude = 0.15;

    for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < grid_count; j++) {
            for (let i = 0; i < grid_count + 40; i++) {//for non-square canvas
            
                push();
                translate(i * cell_size + cell_size / 2, j * cell_size + cell_size / 2);

                let grad_dir = createVector(noise(i * 0.1, j * 0.1 + frameCount * 0.007, 5) - 0.5, noise(i * 0.1, j * 0.1 + frameCount * 0.007, 10) - 0.5);
            
                let perp_dir = createVector(-grad_dir.y, grad_dir.x).normalize();

                let grad_mag = grad_dir.mag();

                let noise_laplacian = createVector(
                    noise((i + 1) * 0.1, j * 0.1 + frameCount * 0.007, 5) + noise((i - 1) * 0.1, j * 0.1 + frameCount * 0.007, 5) - 2 * noise(i * 0.1, j * 0.1 + frameCount * 0.007, 5),
                    noise(i * 0.1, (j + 1) * 0.1 + frameCount * 0.007, 10) + noise(i * 0.1, (j - 1) * 0.1 + frameCount * 0.007, 10) - 2 * noise(i * 0.1, j * 0.1 + frameCount * 0.007, 10)
                );
                let lap_mag = noise_laplacian.mag();

                perp_dir = noise_laplacian;

                
                perp_dir = createVector(1, 0).rotate(perp_dir.heading() - perp_dir.heading() % (PI / 4)).normalize();
                if (Math.abs(perp_dir.dot(createVector(0, 1)) * perp_dir.dot(createVector(1, 0))) > 0.0001) {
                    perp_dir.mult(1.38);
                }else{
                    perp_dir.mult(0.95);
                }
                
                if (grad_mag > cutoff_magnitude) {
                    stroke(lin);
                    strokeWeight(1);
                    if (pass == 0) line(perp_dir.x * cell_size / 2, perp_dir.y * cell_size / 2, -perp_dir.x * cell_size / 2, -perp_dir.y * cell_size / 2);
                    pop();
                    continue;
                }

                strokeWeight(1);
                //strokeWeight(noise(i * 0.1, j * 0.1 + frameCount * 0.007, 0) + 2);
                if (Math.abs(perp_dir.dot(createVector(1, 1))) < 0.0001) {
                    incline_tile(0, 0);
                } else if (Math.abs(perp_dir.dot(createVector(1, -1))) < 0.0001) {
                    decline_tile(0, 0);
                } else if (Math.abs(perp_dir.dot(createVector(1, 0))) < 0.0001) {
                    let tile_above_heading = createVector(noise(i * 0.1, (j - 1) * 0.1 + frameCount * 0.007, 5) - 0.5, noise(i * 0.1, (j - 1) * 0.1 + frameCount * 0.007, 10) - 0.5).normalize();
                    tile_above_heading = createVector(-tile_above_heading.y, tile_above_heading.x);
                    tile_above_heading = createVector(1, 0).rotate(tile_above_heading.heading() - tile_above_heading.heading() % (PI / 4)).normalize();
                    let tile_under_mag = createVector(noise(i * 0.1, (j + 1) * 0.1 + frameCount * 0.007, 5) - 0.5, noise(i * 0.1, (j + 1) * 0.1 + frameCount * 0.007, 10) - 0.5).mag();
                    vertical_tile(0, 0, tile_above_heading, tile_under_mag > cutoff_magnitude);
                } else if (Math.abs(perp_dir.dot(createVector(0, 1))) < 0.0001) {
                    horizontal_tile(0, 0);
                }

                pop();
            }
        }
    }



}