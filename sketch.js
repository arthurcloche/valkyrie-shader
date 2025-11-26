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
  img = loadImage("logo.png");
  stroked = loadImage("logo-stroke.png");
}

const DOM = document.getElementById("main-canvas");

function setup() {
  // Fixed height of 700px, Width matches the window width
  let h = 700;
  let w = windowWidth;

  createCanvas(w, h, WEBGL, DOM);

  // --- GUI Setup ---
  gui = new lil.GUI();
  /*
  const flowFolder = gui.addFolder("Flowmap");
  flowFolder.add(config.flow, "falloff", 0.0, 1.0);
  flowFolder.add(config.flow, "alpha", 0.0, 1.0);
  flowFolder.add(config.flow, "dissipation", 0.8, 1.0);

  const stripesFolder = gui.addFolder("Stripes");
  stripesFolder.add(config.stripes, "cellsX", 1.0, 1024.0, 1, 16);
  stripesFolder.add(config.stripes, "cellsY", 1.0, 1024.0, 1, 64);
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
  */
  // ...

  flowmapPass = new ShaderPass(baseVert, flowFrag, { type: "pingpong" });
  stripeShader = new ShaderPass(baseVert, stripeFrag, { type: "single" });

  // 3. Bloom Pass (Unreal Bloom)
  bloomPass = new UnrealBloomPass(null, {
    strength: config.bloom.strength,
    radius: config.bloom.radius,
    threshold: config.bloom.threshold,
  });
  bloomComposite = createFramebuffer({ format: FLOAT });
  bufferPlane = createFramebuffer({ format: FLOAT });
  bufferPaneShader = createShader(baseVert, copyFrag);
  //   // 4. Chromatic Aberration (Final Output to Screen)
  //   chromaticPass = new ShaderPass(baseVert, chromaticFrag, { type: "screen" });

  // 4. Output Pass (Just draws texture to screen)
  // cascadeShader = new ShaderPass(baseVert, cascadeFrag, {
  //   type: "single",
  //   width: "60%",
  // });

  cascadeShader = new ShaderPass(baseVert, cascadeFrag, {
    type: "pingpong",
  });
  strokedCascadeShader = new ShaderPass(baseVert, cascadeStrokedFrag, {
    type: "pingpong",
  });

  chromaticPass = new ShaderPass(baseVert, chromaticFrag, {
    type: "single",
  });

  linePass = new ShaderPass(baseVert, linesFrag, {
    type: "single",
  });

  outputPass = new ShaderPass(baseVert, outputFrag, {
    type: "screen",
    // width: "60%",
  });

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

  cascadeShader.update({
    uTexture: cascadeShader.output.color,
    image_resolution: [img.width, img.height],
    img: img,
  });
  strokedCascadeShader.update({
    uTexture: strokedCascadeShader.output.color,
    image_resolution: [img.width, img.height],
    img: stroked,
  });

  linePass.update({
    uTexture: cascadeShader.output.color,
    uFlow: flowmapPass.output.color,
  });

  // bufferPlane.begin();
  // clear();
  // bufferPaneShader.setUniform("uTexture", cascadeShader.output.color);
  // shader(bufferPaneShader);
  // plane(width * 0.6, height);
  // bufferPlane.end();
  /*
  // --- Step 2: Render Stripes ---
  stripeShader.update({
    resolution: [width, height],
    image_resolution: [375, 563],
    time: millis() / 1000.0,
    flowmap: bufferPlane.color,

    cellsX: config.stripes.cellsX,
    cellsY: config.stripes.cellsY,
    widthPow: config.stripes.widthPow,
    edge: config.stripes.edge,
    saturation: config.stripes.saturation,

    mouse: getMouseUniforms(), // Stripe shader defines vec3 mouse
  });

  // --- Step 3: Bloom (Unreal) ---
  // 1. Downsample & Blur
  

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
*/
  // bloomPass.render(cascadeShader.output.color);
  // bloomPass.composite(bloomComposite);

  // chromaticPass.update({
  //   uTexture: cascadeShader.output.color,
  //   resolution: [width, height],
  //   time: millis() / 1000.0,
  //   s_1: config.chromatic.power,
  //   s_2: config.chromatic.intensity,
  //   s_3: config.chromatic.pos,
  //   s_4: config.chromatic.saturation,
  //   s_5: config.chromatic.mix,
  // });

  outputPass.update({
    uTexture: cascadeShader.output.color,
    uStroked: strokedCascadeShader.output.color,
    uLines: linePass.output.color,
    uFlow: flowmapPass.output.color,
    uMask: bufferPlane.color,
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
