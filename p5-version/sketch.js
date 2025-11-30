let stripeShader, flowmapPass, bloomPass, chromaticPass, outputPass;
let bloomComposite; // FBO for bloom result
let img;
let logoBuffer; // offscreen canvas for logo
let gui;

// hacky loop duration : to readjust in the shader class
let time = 0;
// Configuration object for GUI
const config = {
  // Flowmap
  flow: {
    falloff: 0.4,
    alpha: 0.9,
    dissipation: 0.95,
  },
  stripes: {
    cellsX: 128,
    cellsY: 16,
    widthPow: 0.5,
    edge: 0.03, // 0.01 to 0.03,
    saturation: 8,
  },
  // Bloom
  bloom: {
    strength: 1.0,
    radius: 0.5,
    threshold: 0.0,
  },
  // Chromatic Aberration
  chromatic: {
    power: 0.5, // s_1: max distortion
    intensity: 0.3, // s_2: distortion intensity
    pos: 0.5, // s_3: center position
    saturation: 1.2, // s_4: saturation adjustment
    mix: 1.0, // s_5: blend with original
  },
  // Cascade
  cascade: {
    copies_offset: 0.5,
    spread_x: 0.75,
    spread_y: 0.45,
    grain: 0.25,
    grain_strength: 0.5,
    fade: 0.05,
    alpha: 0.2,
    speed: 3.0,
    grain_speed: 5.0,
    blend_progress: 5.5,
  },
  // Lines
  lines: {
    spacing: 8.0,
    thick: 1.5,
  },
  // Debug / Output
  output: "bloom", // 'stripes', 'bloom', 'final'
};

const copyFrag = `#version 300 es
precision mediump float;
in vec2 vTexCoord;
out vec4 fragColor;
uniform sampler2D uTexture;
void main() {
    fragColor = texture(uTexture, vTexCoord);
}
`;

function preload() {
  img = loadImage("../logo.png");
  stroked = loadImage("../logo-stroke.png");
}

const DOM = document.getElementById("main-canvas");

function setup() {
  let h = 700;
  let w = windowWidth;

  createCanvas(w, h, WEBGL, DOM);

  // --- GUI Setup ---
  gui = new lil.GUI();

  const flowFolder = gui.addFolder("Flowmap");
  flowFolder.add(config.flow, "falloff", 0.0, 1.0);
  flowFolder.add(config.flow, "alpha", 0.0, 1.0);
  flowFolder.add(config.flow, "dissipation", 0.8, 1.0);

  const cascadeFolder = gui.addFolder("Cascade");
  cascadeFolder.add(config.cascade, "copies_offset", -1.0, 1.0);
  cascadeFolder.add(config.cascade, "spread_x", 0.0, 2.0);
  cascadeFolder.add(config.cascade, "spread_y", 0.0, 2.0);
  cascadeFolder.add(config.cascade, "grain", 0.0, 1.0);
  cascadeFolder.add(config.cascade, "grain_strength", 0.0, 1.0);
  cascadeFolder.add(config.cascade, "fade", 0.0, 0.2);
  cascadeFolder.add(config.cascade, "alpha", 0.0, 1.0);
  cascadeFolder.add(config.cascade, "speed", 0.0, 10.0);
  cascadeFolder.add(config.cascade, "grain_speed", 0.0, 10.0);
  cascadeFolder.add(config.cascade, "blend_progress", 0.0, 10.0);

  const linesFolder = gui.addFolder("Lines");
  linesFolder.add(config.lines, "spacing", 1.0, 64.0);
  linesFolder.add(config.lines, "thick", 0.1, 8.0);

  flowmapPass = new ShaderPass(baseVert, flowFrag, { type: "pingpong" });

  cascadeShader = new ShaderPass(baseVert, cascadeFrag, {
    type: "pingpong",
  });

  linePass = new ShaderPass(baseVert, linesFrag, {
    type: "single",
  });

  outputPass = new ShaderPass(baseVert, outputFrag, {
    type: "screen",
  });

  drawLogoBuffer();
  noStroke();
}

function drawLogoBuffer() {
  // Create or recreate the offscreen buffer at canvas size
  if (logoBuffer) logoBuffer.remove();
  logoBuffer = createGraphics(width, height);
  logoBuffer.background(0);

  // Calculate logo dimensions to fit width (max 800px or 90% of canvas)
  const maxWidth = min(800, width * 0.9);
  const scale = maxWidth / img.width;
  const logoW = img.width * scale;
  const logoH = img.height * scale;

  // Center horizontally, top margin
  const x = (width - logoW) / 2;
  const y = height * 0.025;

  logoBuffer.image(img, x, y, logoW, logoH);
}

function draw() {
  // --- Step 1: Update Flowmap ---
  flowmapPass.update({
    uTexture: flowmapPass.output.color,
    time: millis() / 1000,
    resolution: [width, height],
    falloff: config.flow.falloff,
    alpha: config.flow.alpha,
    dissipation: config.flow.dissipation,
    mouse: getMouseUniforms().slice(0, 2),
    velocity: getVelocityUniforms(),
  });

  cascadeShader.update({
    uTexture: cascadeShader.output.color,
    img: logoBuffer,
    copies_offset: config.cascade.copies_offset,
    spread_x: config.cascade.spread_x,
    spread_y: config.cascade.spread_y,
    grain: config.cascade.grain,
    grain_strength: config.cascade.grain_strength,
    fade: config.cascade.fade,
    alpha: config.cascade.alpha,
    speed: config.cascade.speed,
    grain_speed: config.cascade.grain_speed,
    blend_progress: config.cascade.blend_progress,
  });
  // strokedCascadeShader.update({
  //   uTexture: strokedCascadeShader.output.color,
  //   image_resolution: [img.width, img.height],
  //   img: stroked,
  // });

  linePass.update({
    uTexture: cascadeShader.output.color,
    uFlow: flowmapPass.output.color,
    spacing: config.lines.spacing,
    thick: config.lines.thick,
  });

  outputPass.update({
    uTexture: cascadeShader.output.color,
    uLines: linePass.output.color,
    uFlow: flowmapPass.output.color,
  });

  if (frameCount >= 8 * 60) {
    cascadeShader.reset();
    linePass.reset();
    flowmapPass.reset();
    frameCount = 0;
  }
}

function windowResized() {
  // Fixed height, variable width
  let h = 700;
  let w = windowWidth;
  resizeCanvas(w, h);

  // Redraw logo at new size
  drawLogoBuffer();

  // Resize all shader pass framebuffers
  flowmapPass.resize();
  cascadeShader.resize();
  linePass.resize();
  outputPass.resize();
}

// --- Helpers ---

let mouseVec, pmouseVec, velocityVec;
let smoothVelocity = null; // persisted between frames

function getMouseUniforms() {
  const mx = constrain(mouseX, 0, width) / width;
  const my = constrain(mouseY, 0, height) / height;
  return [mx, my, mouseIsPressed];
}

function getVelocityUniforms() {
  const mx = constrain(mouseX, 0, width) / width;
  const my = constrain(mouseY, 0, height) / height;
  const pmx = constrain(pmouseX, 0, width) / width;
  const pmy = constrain(pmouseY, 0, height) / height;

  mouseVec = createVector(mx, my);
  pmouseVec = createVector(pmx, pmy);

  // Raw velocity this frame
  const rawVel = mouseVec.copy().sub(pmouseVec);
  const hasMotion = rawVel.mag() > 0.0001;

  // Initialize smooth velocity if needed
  if (!smoothVelocity) smoothVelocity = createVector(0, 0);

  if (hasMotion) {
    // Lerp towards normalized velocity when moving
    const targetVel = rawVel.copy().normalize();
    smoothVelocity.lerp(targetVel, 0.3);
  } else {
    // Decay towards zero when stopped
    smoothVelocity.mult(0.95);
  }

  return [smoothVelocity.x, smoothVelocity.y];
}
