let stripeShader, flowmapPass, bloomPass, chromaticPass, outputPass;
let bloomComposite; // FBO for bloom result
let img;

function preload() {
  //   img = loadImage("src.jpg");
}

const DOM = document.getElementById("main-canvas");

function setup() {
  // Fixed height of 700px, Width matches the window width
  let h = 700;
  let w = windowWidth;

  createCanvas(w, h, WEBGL, DOM);

  // ...

  //   img.resize(w * 0.5, 0);

  flowmapPass = new ShaderPass(baseVert, flowFrag, { type: "pingpong" });
  stripeShader = new ShaderPass(baseVert, stripeFrag, { type: "single" });

  // 3. Bloom Pass (Unreal Bloom)
  bloomPass = new UnrealBloomPass(null, {
    strength: 0.0,
    radius: 0.125,
    threshold: 0.0,
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
    falloff: 0.3,
    alpha: 0.9,
    dissipation: 0.98,
    mouse: getMouseUniforms().slice(0, 2),
    velocity: getVelocityUniforms(),
  });

  // --- Step 2: Render Stripes ---
  stripeShader.update({
    resolution: [width, height],
    image_resolution: [375, 563],
    time: millis() / 1000.0,
    flowmap: flowmapPass.output.color,
    mouse: getMouseUniforms(), // Stripe shader defines vec3 mouse
  });

  // --- Step 3: Bloom (Unreal) ---
  // 1. Downsample & Blur
  bloomPass.render(stripeShader.output.color);

  // 2. Composite
  bloomPass.composite(bloomComposite);

  // --- Step 4: Output to Screen ---
  // Visualize bloom composite
  outputPass.update({
    uTexture: bloomComposite.color,
  });
}

function windowResized() {
  // Fixed height, variable width
  let h = 700;
  let w = windowWidth;
  resizeCanvas(w, h);
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
