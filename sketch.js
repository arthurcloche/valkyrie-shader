let stripeShader, flowmapPass, bloomPass, chromaticPass, outputPass;
let bloomComposite; // FBO for bloom result
let img;
let gui;

// Configuration object for GUI
const config = {
  // Flowmap
  flow: {
    falloff: 0.3,
    alpha: 0.9,
    dissipation: 0.98,
  },
  stripes: {
    cellsX: 0.1,
    cellsY: 0.1,
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
  // Debug / Output
  output: "bloom", // 'stripes', 'bloom', 'final'
};

function preload() {
  //   img = loadImage("src.jpg");
}

const DOM = document.getElementById("main-canvas");

function setup() {
  // Fixed height of 700px, Width matches the window width
  let h = 700;
  let w = windowWidth;

  createCanvas(w, h, WEBGL, DOM);

  // --- GUI Setup ---
  gui = new lil.GUI();

  const flowFolder = gui.addFolder("Flowmap");
  flowFolder.add(config.flow, "falloff", 0.0, 1.0);
  flowFolder.add(config.flow, "alpha", 0.0, 1.0);
  flowFolder.add(config.flow, "dissipation", 0.8, 1.0);

  const stripesFolder = gui.addFolder("Stripes");
  stripesFolder.add(config.stripes, "cellsX", 0.0, 1.0, 0.1, 0.1);
  stripesFolder.add(config.stripes, "cellsY", 0.0, 1.0, 0.1, 0.1);
  stripesFolder.add(config.stripes, "widthPow", 0.1, 4, 0.01, 0.5);
  stripesFolder.add(config.stripes, "edge", 0.03, 0.05, 0.001, 0.03);
  stripesFolder.add(config.stripes, "saturation", 1.0, 8.0);

  const bloomFolder = gui.addFolder("Bloom");
  bloomFolder
    .add(config.bloom, "strength", 0.0, 5.0)
    .onChange((v) => (bloomPass.strength = v));
  bloomFolder
    .add(config.bloom, "radius", 0.0, 1.5)
    .onChange((v) => (bloomPass.radius = v));
  bloomFolder
    .add(config.bloom, "threshold", 0.0, 1.0)
    .onChange((v) => (bloomPass.threshold = v));

  const outputFolder = gui.addFolder("Output");
  outputFolder.add(config, "output", ["stripes", "bloom", "flow"]);

  // ...

  //   img.resize(w * 0.5, 0);

  flowmapPass = new ShaderPass(baseVert, flowFrag, { type: "pingpong" });
  stripeShader = new ShaderPass(baseVert, stripeFrag, { type: "single" });

  // 3. Bloom Pass (Unreal Bloom)
  bloomPass = new UnrealBloomPass(null, {
    strength: config.bloom.strength,
    radius: config.bloom.radius,
    threshold: config.bloom.threshold,
  });
  bloomComposite = createFramebuffer({ format: FLOAT });

  //   // 4. Chromatic Aberration (Final Output to Screen)
  //   chromaticPass = new ShaderPass(baseVert, chromaticFrag, { type: "screen" });

  // 4. Output Pass (Just draws texture to screen)
  outputPass = new ShaderPass(baseVert, outputFrag, { type: "screen" });

  noStroke();
}

function draw() {
  // --- Step 1: Update Flowmap ---
  flowmapPass.update({
    time: frameCount * 0.05,
    uTexture: flowmapPass.output.color,
    resolution: [width, height],
    falloff: config.flow.falloff,
    alpha: config.flow.alpha,
    dissipation: config.flow.dissipation,
    mouse: getMouseUniforms().slice(0, 2),
    velocity: getVelocityUniforms(),
  });

  // --- Step 2: Render Stripes ---
  stripeShader.update({
    resolution: [width, height],
    image_resolution: [375, 563],
    time: millis() / 1000.0,
    flowmap: flowmapPass.output.color,

    cellsX: config.stripes.cellsX,
    cellsY: config.stripes.cellsY,
    widthPow: config.stripes.widthPow,
    edge: config.stripes.edge,
    saturation: config.stripes.saturation,

    mouse: getMouseUniforms(), // Stripe shader defines vec3 mouse
  });

  // --- Step 3: Bloom (Unreal) ---
  // 1. Downsample & Blur
  bloomPass.render(stripeShader.output.color);

  // 2. Composite
  bloomPass.composite(bloomComposite);

  // --- Step 4: Output to Screen ---
  // Select output based on GUI config
  let texToDraw;
  if (config.output === "stripes") {
    texToDraw = stripeShader.output.color;
  } else if (config.output === "bloom") {
    texToDraw = bloomComposite.color;
  } else if (config.output === "flow") {
    texToDraw = flowmapPass.output.color;
  }

  outputPass.update({
    uTexture: texToDraw,
  });
}

function windowResized() {
  // Fixed height, variable width
  let h = 700;
  let w = windowWidth;
  resizeCanvas(w, h);

  // Resize Bloom Buffers
  if (bloomPass) bloomPass.setSize(w, h);
}

// --- Helpers ---

let mouseVec, pmouseVec, velocityVec;
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
  velocityVec = mouseVec.copy().sub(pmouseVec).mult(1).normalize();

  return [velocityVec.x, velocityVec.y];
}
