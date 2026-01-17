/**
 * Pass - Self-contained render pass with its own FBO
 */
class Pass {
  constructor(gl, { fragment, vertex = null, width, height, useFloat = true, pingPong = false, scale = 1, quadVAO, getScreenSize }) {
    this.gl = gl;
    this.quadVAO = quadVAO;
    this.getScreenSize = getScreenSize;
    this.scale = scale;
    this.useFloat = useFloat;
    this.pingPong = pingPong;
    this._width = Math.floor(width * scale);
    this._height = Math.floor(height * scale);

    this.program = this._createProgram(vertex || Pass.defaultVert, fragment);

    if (pingPong) {
      this.read = this._createFBO(this._width, this._height);
      this.write = this._createFBO(this._width, this._height);
    } else {
      this.fbo = this._createFBO(this._width, this._height);
    }

    this._textureUnit = 0;
  }

  static defaultVert = `#version 300 es
in vec4 aPosition;
out vec2 vTexCoord;
void main() {
  vTexCoord = aPosition.xy * 0.5 + 0.5;
  gl_Position = aPosition;
}`;

  get texture() {
    return this.pingPong ? this.read.texture : this.fbo.texture;
  }

  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  _createProgram(vertSource, fragSource) {
    const gl = this.gl;
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSource);
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSource);

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
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

  _createFBO(width, height) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.useFloat ? gl.RGBA16F : gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      this.useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo, texture, width, height };
  }

  resize(width, height) {
    const gl = this.gl;
    this._width = Math.floor(width * this.scale);
    this._height = Math.floor(height * this.scale);

    const resizeFBO = (fboData) => {
      gl.bindTexture(gl.TEXTURE_2D, fboData.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        this.useFloat ? gl.RGBA16F : gl.RGBA8,
        this._width,
        this._height,
        0,
        gl.RGBA,
        this.useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null
      );
      fboData.width = this._width;
      fboData.height = this._height;
    };

    if (this.pingPong) {
      resizeFBO(this.read);
      resizeFBO(this.write);
    } else {
      resizeFBO(this.fbo);
    }
  }

  clear() {
    const gl = this.gl;
    const clearFBO = (fboData) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboData.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    if (this.pingPong) {
      clearFBO(this.read);
      clearFBO(this.write);
    } else {
      clearFBO(this.fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render(uniforms = {}) {
    const gl = this.gl;
    this._textureUnit = 0;

    gl.useProgram(this.program.program);

    const target = this.pingPong ? this.write : this.fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);

    this._setUniforms(uniforms);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (this.pingPong) {
      [this.read, this.write] = [this.write, this.read];
    }

    return this;
  }

  toScreen(uniforms = {}) {
    const gl = this.gl;
    this._textureUnit = 0;
    const [w, h] = this.getScreenSize();

    gl.useProgram(this.program.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);

    this._setUniforms(uniforms);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return this;
  }

  _setUniforms(uniforms) {
    const gl = this.gl;
    const locs = this.program.uniforms;

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = locs[name];
      if (loc === undefined) continue;

      if (typeof value === "number") {
        gl.uniform1f(loc, value);
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else if (value.length === 4) gl.uniform4fv(loc, value);
      } else if (value && typeof value === "object" && "texture" in value) {
        gl.activeTexture(gl.TEXTURE0 + this._textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, value.texture);
        gl.uniform1i(loc, this._textureUnit);
        this._textureUnit++;
      }
    }
  }

  destroy() {
    const gl = this.gl;
    if (this.program?.program) gl.deleteProgram(this.program.program);

    const deleteFBO = (fboData) => {
      if (fboData.texture) gl.deleteTexture(fboData.texture);
      if (fboData.fbo) gl.deleteFramebuffer(fboData.fbo);
    };

    if (this.pingPong) {
      deleteFBO(this.read);
      deleteFBO(this.write);
    } else {
      deleteFBO(this.fbo);
    }
  }
}

/**
 * Renderer - Base WebGL2 renderer with pass management
 */
class Renderer {
  constructor(container) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;

    if (!this.container) {
      throw new Error("Renderer: Container not found");
    }

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
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
    this.passes = {};
    this.textures = {};
    this.quadVAO = null;
  }

  async init() {
    this._createCanvas();
    this._initWebGL();
    this._createQuad();
    await this.setup(); // User-defined
    this._bindEvents();
    this.start();
  }

  // Override this to create passes
  async setup() {}

  // Override this for render loop
  draw() {}

  _createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.container.appendChild(this.canvas);
    this._updateSize();
  }

  _updateSize() {
    const rect = this.container.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.floor(rect.width * this.dpr);
    this.height = Math.floor(rect.height * this.dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  _initWebGL() {
    this.gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });

    if (!this.gl) {
      throw new Error("WebGL2 not supported");
    }

    this.gl.getExtension("EXT_color_buffer_float");
    this.gl.clearColor(0, 0, 0, 1);
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

  // Create a pass with shared config
  createPass(fragment, options = {}) {
    return new Pass(this.gl, {
      fragment,
      width: this.width,
      height: this.height,
      quadVAO: this.quadVAO,
      getScreenSize: () => [this.width, this.height],
      ...options,
    });
  }

  // Wrap texture for uniform binding
  tex(texture) {
    return { texture };
  }

  // Load image as texture
  async loadTexture(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        resolve({ texture, width: img.width, height: img.height, image: img });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  _resizePasses() {
    for (const pass of Object.values(this.passes)) {
      pass.resize(this.width, this.height);
    }
  }

  _bindEvents() {
    const updateMouse = (x, y) => {
      const rect = this.canvas.getBoundingClientRect();
      this.prevMouse.x = this.mouse.x;
      this.prevMouse.y = this.mouse.y;
      this.mouse.x = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      this.mouse.y = 1.0 - Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    };

    this.canvas.addEventListener("mouseenter", () => (this.mouseInBounds = true));
    this.canvas.addEventListener("mouseleave", () => (this.mouseInBounds = false));
    this.canvas.addEventListener("mousemove", (e) => updateMouse(e.clientX, e.clientY));
    this.canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        this.mouseInBounds = true;
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );
    this.canvas.addEventListener("touchend", () => (this.mouseInBounds = false));

    this._resizeObserver = new ResizeObserver(() => {
      this._updateSize();
      if (this.gl) {
        this.gl.viewport(0, 0, this.width, this.height);
        this._resizePasses();
        this.onResize?.();
      }
    });
    this._resizeObserver.observe(this.container);

    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!this.running && this._wasRunning !== false) this.start();
          } else {
            this._wasRunning = this.running;
            if (this.running) this.stop();
          }
        });
      },
      { threshold: 0.1 }
    );
    this._intersectionObserver.observe(this.container);
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

  _render() {
    if (!this.running) return;

    this.time = (performance.now() - this.startTime) / 1000;
    this._updateVelocity();

    this.draw(); // User-defined

    this.animationId = requestAnimationFrame(() => this._render());
  }

  clearPasses() {
    for (const pass of Object.values(this.passes)) {
      pass.clear();
    }
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
    this.clearPasses();
    this.startTime = performance.now();
  }

  destroy() {
    this.stop();
    this._resizeObserver?.disconnect();
    this._intersectionObserver?.disconnect();

    const gl = this.gl;
    if (gl) {
      for (const pass of Object.values(this.passes)) {
        pass.destroy();
      }
      for (const tex of Object.values(this.textures)) {
        if (tex?.texture) gl.deleteTexture(tex.texture);
      }
      if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    }

    this.canvas?.remove();
  }
}

