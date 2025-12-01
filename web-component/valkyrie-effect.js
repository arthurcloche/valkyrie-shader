/**
 * <valkyrie-effect> Web Component
 * 
 * Usage:
 *   <valkyrie-effect logo="logo.png" logo-max-width="800"></valkyrie-effect>
 * 
 * Attributes:
 *   - logo: URL to the logo image
 *   - logo-max-width: Maximum width of the logo in CSS pixels (default: 800)
 *   - loop-duration: Duration before reset in seconds (default: 10, 0 = no loop)
 */

// Shader sources (bundled)
const SHADERS = {
  vert: `#version 300 es
in vec4 aPosition;
out vec2 vTexCoord;
void main() {
  vTexCoord = aPosition.xy * 0.5 + 0.5;
  gl_Position = aPosition;
}`,

  flow: `#version 300 es
precision mediump float;

#define PI 3.14159265359
uniform float time;
uniform vec2 resolution;
in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float falloff;
uniform float alpha;
uniform float dissipation;
uniform vec2 mouse;
uniform vec2 velocity;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vTexCoord;
  vec4 color = texture(uTexture, uv) * dissipation;
  vec2 cursor = uv - mouse;
  cursor.x *= resolution.x / resolution.y;
  float angle = atan(cursor.y, cursor.x);
  float dist = length(cursor);
  vec2 loopCoord = vec2(cos(angle + time + velocity.y), sin(angle + time + velocity.x));
  float noiseVal = snoise(loopCoord + dist + time * 0.1 + length(velocity)) * 0.125;
  float blobDist = dist * (1.0 + noiseVal);
  vec3 stamp = vec3(velocity * vec2(1, -1), 1.0 - pow(1.0 - min(1.0, length(velocity * (1.-blobDist))), 1.0));
  float fall = smoothstep(falloff, 0.0, blobDist) * alpha;
  color.rgb = mix(color.rgb, stamp, vec3(fall));
  fragColor = vec4(color.rgb, 1.0);
}`,

  cascade: `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D uTexture;
uniform sampler2D img;
uniform float time;
uniform float copies_offset;
uniform float grain;
uniform float blend_delay;
uniform float blend_factor;

float ease(float t) { return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0; }
float cubic(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }

float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = vTexCoord;
  float fadefactor = blend_delay * .25;
  float fadein = min(1.0, time / fadefactor);
  vec4 tex = texture(img, uv);
  vec4 samp = mix(vec4(0.0), tex, fadein);
  uv -= .5;
  
  float progress = min(1.0, time / blend_delay);
  float offprogress = mix(0.1, 0.01, cubic(progress));
  float off = (-copies_offset * offprogress) * cubic(progress);
  float salt = hash13(vec3(gl_FragCoord.xy, 3.) + time * 500. + 50.) * 2.-1.;
  float salt2 = hash13(vec3(gl_FragCoord.xy * 256., 7.) + time * 1100. + 31.) * 2.-1.;
   
  float spreadx = mix(0., 0.125, cubic(cubic(progress)));
  float spready = mix(0., 0.025, ease(progress));
  
  uv *= vec2(0.9 + spreadx, 0.975 + spready);
  uv -= vec2(0., off);
  uv -= vec2(-salt2 * grain/10., salt * grain/10.) * .25;
  uv += .5;
  
  vec4 prev = texture(uTexture, uv);
  
  float t = time;
  float mixFactor = (t < blend_delay) ? blend_factor : mix(blend_factor, 1.0, min((t - blend_delay) / (blend_delay + 1.), 1.0));
  vec4 color = mix(prev, samp, ease(mixFactor));
  color = mix(color, samp, cubic(max(0., min(1., t - (blend_delay * .5)))));
  fragColor = color;
}`,

  lines: `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uFlow;
uniform vec2 resolution;
uniform float time;
uniform float spacing;
uniform float thick;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float to_stripe(in float frag_y, in float bright) {
  float saw = mod(frag_y, spacing) - 0.5 * spacing;
  float tri = abs(saw);
  tri = tri - 0.5 * (1.-bright);
  return clamp(tri, 0.0, 1.0);
}

void main() {
  vec2 coords = vTexCoord;
  vec3 flow_rgb = texture(uFlow, coords).rgb;
  float flow = flow_rgb.b;
  vec2 fragcoord = vTexCoord * resolution;
  float y_samp = fragcoord.y - mod(fragcoord.y, spacing);
  vec2 uv = vec2(fragcoord.x, y_samp) / resolution;
  float noi = snoise(uv * .0125 + flow + time);
  uv -= .5; 
  uv *= 1. + ((noi * 2.) - 1.) * .5;
  uv += .5;
  
  float bright = flow * 0.25;
  bright = clamp(bright, 0.0, 1.0);
  float perturbed_y = fragcoord.y - spacing * bright;
  float col = to_stripe(perturbed_y, bright + noi);
  fragColor = vec4(vec3(1. - col), 1.);
}`,

  output: `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uFlow;
uniform sampler2D uLines;
uniform float time;

vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 tint(float value) {
  return pal(value, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 0.5), vec3(0.8, 0.90, 0.30));
}

float ease(float t) { return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0; }

vec3 ACES(vec3 x) {
  x = clamp(x, -40.0, 40.0);
  vec3 exp_neg_2x = exp(-2.0 * x);
  return clamp(-1.0 + 2.0 / (1.0 + exp_neg_2x), vec3(0.), vec3(1.));
}

void main() {
  vec2 uv = vTexCoord;
  float sampled = texture(uTexture, vTexCoord).r;
  float lined = texture(uLines, vTexCoord).r;
  float flow = texture(uFlow, vTexCoord).b;
  float render = lined * sampled + sampled + flow * lined;
  vec3 colored = mix(vec3(render), tint(render + 1. + uv.y * .5 + sin(time + uv.y) * .35), 1. - render) * 4.;
  vec3 toscreen = mix(vec3(0.), colored, render);
  float fadein = ease(min(1.0, time / 2.0));
  vec3 intro = mix(vec3(0.), toscreen, fadein);
  fragColor = vec4(ACES(intro * 2.), 1.);
}`
};

class ValkyrieEffectElement extends HTMLElement {
  static get observedAttributes() {
    return ['logo', 'logo-max-width', 'loop-duration'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Default config
    this.config = {
      flow: { falloff: 0.3, alpha: 0.5, dissipation: 0.975 },
      cascade: { copies_offset: 0.95, grain: 0.5, blend_delay: 5.0, blend_factor: 0.25 },
      lines: { spacing: 8.0, thick: 2.5 },
      logoUrl: 'logo.png',
      logoMaxWidth: 800,
      loopDuration: 0,
    };

    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.startTime = 0;
    this.running = false;
    this.animationId = null;

    this.mouse = { x: 0.5, y: 0.5 };
    this.prevMouse = { x: 0.5, y: 0.5 };
    this.smoothVelocity = { x: 0, y: 0 };
    this.mouseInBounds = false;

    this.gl = null;
    this.canvas = null;
    this.programs = {};
    this.fbos = {};
    this.quadVAO = null;
    this.logoImage = null;
    this.logoTexture = null;
  }

  connectedCallback() {
    this._setup();
  }

  disconnectedCallback() {
    this.destroy();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    switch (name) {
      case 'logo':
        this.config.logoUrl = newValue;
        if (this.gl) this._loadLogo();
        break;
      case 'logo-max-width':
        this.config.logoMaxWidth = parseFloat(newValue) || 800;
        if (this.gl) this._createLogoTexture();
        break;
      case 'loop-duration':
        this.config.loopDuration = parseFloat(newValue) || 0;
        break;
    }
  }

  async _setup() {
    // Create shadow DOM structure
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }
        canvas {
          display: block;
          width: 100%;
          height: 100%;
        }
      </style>
      <canvas></canvas>
    `;

    this.canvas = this.shadowRoot.querySelector('canvas');
    
    // Read attributes
    if (this.hasAttribute('logo')) {
      this.config.logoUrl = this.getAttribute('logo');
    }
    if (this.hasAttribute('logo-max-width')) {
      this.config.logoMaxWidth = parseFloat(this.getAttribute('logo-max-width')) || 800;
    }
    if (this.hasAttribute('loop-duration')) {
      this.config.loopDuration = parseFloat(this.getAttribute('loop-duration')) || 0;
    }

    this._updateSize();
    this._initWebGL();
    this._createQuad();
    this._createPrograms();
    this._createFramebuffers();
    await this._loadLogo();
    this._bindEvents();
    this.start();
  }

  _updateSize() {
    const rect = this.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.floor(rect.width * dpr);
    this.height = Math.floor(rect.height * dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  _initWebGL() {
    this.gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });

    if (!this.gl) throw new Error('WebGL2 not supported');

    this.gl.getExtension('EXT_color_buffer_float');
    this.gl.clearColor(0, 0, 0, 1);
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  _createProgram(vertSrc, fragSrc) {
    const gl = this.gl;
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Link error:', gl.getProgramInfoLog(program));
      return null;
    }

    const uniforms = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    return { program, uniforms };
  }

  _createQuad() {
    const gl = this.gl;
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  _createPrograms() {
    this.programs.flow = this._createProgram(SHADERS.vert, SHADERS.flow);
    this.programs.cascade = this._createProgram(SHADERS.vert, SHADERS.cascade);
    this.programs.lines = this._createProgram(SHADERS.vert, SHADERS.lines);
    this.programs.output = this._createProgram(SHADERS.vert, SHADERS.output);
  }

  _createFBO(width, height) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo, texture: tex, width, height };
  }

  _createPingPongFBO(width, height) {
    return {
      read: this._createFBO(width, height),
      write: this._createFBO(width, height),
      swap() { [this.read, this.write] = [this.write, this.read]; }
    };
  }

  _createFramebuffers() {
    this.fbos.flow = this._createPingPongFBO(this.width, this.height);
    this.fbos.cascade = this._createPingPongFBO(this.width, this.height);
    this.fbos.lines = this._createFBO(this.width, this.height);
  }

  _resizeFramebuffers() {
    const gl = this.gl;
    const resize = (fboData) => {
      gl.bindTexture(gl.TEXTURE_2D, fboData.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      fboData.width = this.width;
      fboData.height = this.height;
    };
    resize(this.fbos.flow.read);
    resize(this.fbos.flow.write);
    resize(this.fbos.cascade.read);
    resize(this.fbos.cascade.write);
    resize(this.fbos.lines);
  }

  async _loadLogo() {
    return new Promise((resolve) => {
      this.logoImage = new Image();
      this.logoImage.crossOrigin = 'anonymous';
      this.logoImage.onload = () => {
        this._createLogoTexture();
        resolve();
      };
      this.logoImage.onerror = () => {
        console.warn('Failed to load logo');
        resolve();
      };
      this.logoImage.src = this.config.logoUrl;
    });
  }

  _createLogoTexture() {
    const gl = this.gl;
    const img = this.logoImage;
    if (!img || !img.complete) return;

    const rect = this.getBoundingClientRect();
    const cssWidth = rect.width;
    const dpr = this.width / cssWidth;
    const maxWidth = Math.min(this.config.logoMaxWidth, cssWidth * 0.9);
    const scale = maxWidth / img.width;
    const logoW = img.width * scale * dpr;
    const logoH = img.height * scale * dpr;
    const x = (this.width - logoW) / 2;
    const y = this.height * 0.025;

    const offscreen = document.createElement('canvas');
    offscreen.width = this.width;
    offscreen.height = this.height;
    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.drawImage(img, x, y, logoW, logoH);

    if (!this.logoTexture) this.logoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.logoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _bindEvents() {
    const updateMouse = (x, y) => {
      const rect = this.canvas.getBoundingClientRect();
      this.prevMouse.x = this.mouse.x;
      this.prevMouse.y = this.mouse.y;
      this.mouse.x = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      this.mouse.y = 1.0 - Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    };

    this.canvas.addEventListener('mouseenter', () => { this.mouseInBounds = true; });
    this.canvas.addEventListener('mouseleave', () => { this.mouseInBounds = false; });
    this.canvas.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.mouseInBounds = true;
      updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => { this.mouseInBounds = false; });

    this._resizeObserver = new ResizeObserver(() => {
      this._updateSize();
      if (this.gl) {
        this.gl.viewport(0, 0, this.width, this.height);
        this._resizeFramebuffers();
        this._createLogoTexture();
      }
    });
    this._resizeObserver.observe(this);

    this._intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!this.running && this._wasRunning !== false) this.start();
        } else {
          this._wasRunning = this.running;
          if (this.running) this.stop();
        }
      });
    }, { threshold: 0.1 });
    this._intersectionObserver.observe(this);
  }

  _updateVelocity() {
    if (!this.mouseInBounds) {
      this.smoothVelocity.x *= 0.9;
      this.smoothVelocity.y *= 0.9;
      return;
    }

    const dx = this.mouse.x - this.prevMouse.x;
    const dy = this.mouse.y - this.prevMouse.y;
    const mag = Math.sqrt(dx * dx + dy * dy);

    if (mag > 0.01) {
      this.smoothVelocity.x += (dx / mag - this.smoothVelocity.x) * 0.3;
      this.smoothVelocity.y += (dy / mag - this.smoothVelocity.y) * 0.3;
    } else {
      this.smoothVelocity.x *= 0.975;
      this.smoothVelocity.y *= 0.975;
    }
  }

  _setUniforms(prog, uniforms) {
    const gl = this.gl;
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = prog.uniforms[name];
      if (loc === undefined) continue;
      if (typeof value === 'number') gl.uniform1f(loc, value);
      else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
      } else if (value?.unit !== undefined) gl.uniform1i(loc, value.unit);
    }
  }

  _bindTexture(texture, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return { texture, unit };
  }

  _renderPass(prog, target, uniforms) {
    const gl = this.gl;
    gl.useProgram(prog.program);
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
    }
    this._setUniforms(prog, uniforms);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _render() {
    if (!this.running) return;

    this.time = (performance.now() - this.startTime) / 1000;
    this._updateVelocity();

    const cfg = this.config;

    this._renderPass(this.programs.flow, this.fbos.flow.write, {
      uTexture: this._bindTexture(this.fbos.flow.read.texture, 0),
      time: this.time,
      resolution: [this.width, this.height],
      falloff: cfg.flow.falloff,
      alpha: cfg.flow.alpha,
      dissipation: cfg.flow.dissipation,
      mouse: [this.mouse.x, this.mouse.y],
      velocity: [this.smoothVelocity.x, this.smoothVelocity.y],
    });
    this.fbos.flow.swap();

    this._renderPass(this.programs.cascade, this.fbos.cascade.write, {
      uTexture: this._bindTexture(this.fbos.cascade.read.texture, 0),
      img: this._bindTexture(this.logoTexture, 1),
      time: this.time,
      resolution: [this.width, this.height],
      copies_offset: cfg.cascade.copies_offset,
      grain: cfg.cascade.grain,
      blend_delay: cfg.cascade.blend_delay,
      blend_factor: cfg.cascade.blend_factor,
    });
    this.fbos.cascade.swap();

    this._renderPass(this.programs.lines, this.fbos.lines, {
      uTexture: this._bindTexture(this.fbos.cascade.read.texture, 0),
      uFlow: this._bindTexture(this.fbos.flow.read.texture, 1),
      time: this.time,
      resolution: [this.width, this.height],
      spacing: cfg.lines.spacing,
      thick: cfg.lines.thick,
    });

    this._renderPass(this.programs.output, null, {
      uTexture: this._bindTexture(this.fbos.cascade.read.texture, 0),
      uLines: this._bindTexture(this.fbos.lines.texture, 1),
      uFlow: this._bindTexture(this.fbos.flow.read.texture, 2),
      time: this.time,
    });

    if (cfg.loopDuration > 0 && this.time >= cfg.loopDuration) {
      this._clearFBOs();
      this.startTime = performance.now();
      this.smoothVelocity = { x: 0, y: 0 };
    }

    this.animationId = requestAnimationFrame(() => this._render());
  }

  _clearFBOs() {
    const gl = this.gl;
    const clear = (fboData) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboData.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    clear(this.fbos.flow.read);
    clear(this.fbos.flow.write);
    clear(this.fbos.cascade.read);
    clear(this.fbos.cascade.write);
    clear(this.fbos.lines);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this._render();
  }

  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  reset() {
    this._clearFBOs();
    this.startTime = performance.now();
  }

  destroy() {
    this.stop();
    this._resizeObserver?.disconnect();
    this._intersectionObserver?.disconnect();
    
    const gl = this.gl;
    if (gl) {
      Object.values(this.programs).forEach(p => p?.program && gl.deleteProgram(p.program));
      if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
      if (this.logoTexture) gl.deleteTexture(this.logoTexture);
    }
  }
}

// Register the custom element
customElements.define('valkyrie-effect', ValkyrieEffectElement);

