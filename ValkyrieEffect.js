/**
 * ValkyrieEffect - Vanilla WebGL2 shader effect
 * Can be instantiated multiple times on different containers
 */
class ValkyrieEffect {
  constructor(container, options = {}) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;

    if (!this.container) {
      throw new Error("ValkyrieEffect: Container not found");
    }

    // Merge options with defaults
    this.config = {
      flow: {
        falloff: 0.3,
        alpha: 0.5,
        dissipation: 0.975,
      },
      cascade: {
        copies_offset: 0.95,
        grain: 0.5,
        blend_delay: 5.0,
        blend_factor: 0.25,
      },
      lines: {
        spacing: 8.0,
        thick: 2.5,
      },
      bloom: {
        threshold: 0.5,
        softKnee: 0.1,
        radius: 3.0,
        intensity: 0.8,
        noiseScale: 0.45,
      },
      logoUrl: "",
      logoMaxWidth: 800,
      logoPosition: "hero",
      logoClipTop: 30,

      ...options,
    };

    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.startTime = 0;
    this.running = false;
    this.animationId = null;

    // Mouse state
    this.mouse = { x: 0.5, y: 0.5 };
    this.prevMouse = { x: 0.5, y: 0.5 };
    this.smoothVelocity = { x: 0, y: 0 };
    this.mouseInBounds = false;

    // WebGL resources
    this.gl = null;
    this.canvas = null;
    this.programs = {};
    this.fbos = {};
    this.textures = {};
    this.quadVAO = null;
    this.logoImage = null;
    this.logoTexture = null;

    this._init();
  }

  async _init() {
    this._createCanvas();
    this._initWebGL();
    this._createQuad();
    this._createPrograms();
    this._createFramebuffers();
    await this._loadLogo();
    this._bindEvents();
    this.start();
  }

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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.floor(rect.width * dpr);
    this.height = Math.floor(rect.height * dpr);
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

    const gl = this.gl;
    gl.getExtension("EXT_color_buffer_float");
    gl.clearColor(0, 0, 0, 1);
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

    // Cache uniform locations
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
    this.programs.flow = this._createProgram(baseVert, flowFrag);
    this.programs.cascade = this._createProgram(baseVert, cascadeFrag);
    this.programs.lines = this._createProgram(baseVert, linesFrag);
    this.programs.bloomLuminance = this._createProgram(
      baseVert,
      bloomLuminanceFrag
    );
    this.programs.bloomBlurH = this._createProgram(baseVert, bloomBlurHFrag);
    this.programs.bloomBlurV = this._createProgram(baseVert, bloomBlurVFrag);
    this.programs.bloomComposite = this._createProgram(
      baseVert,
      bloomCompositeFrag
    );
    this.programs.output = this._createProgram(baseVert, outputFrag);
  }

  _createFBO(width, height, useFloat = true) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      useFloat ? gl.RGBA16F : gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo, texture: tex, width, height };
  }

  _createPingPongFBO(width, height) {
    return {
      read: this._createFBO(width, height),
      write: this._createFBO(width, height),
      swap() {
        [this.read, this.write] = [this.write, this.read];
      },
    };
  }

  _createFramebuffers() {
    this.fbos.flow = this._createPingPongFBO(this.width, this.height);
    this.fbos.cascade = this._createPingPongFBO(this.width, this.height);
    this.fbos.lines = this._createFBO(this.width, this.height);
    // Bloom at half res for performance
    const bloomW = Math.floor(this.width / 2);
    const bloomH = Math.floor(this.height / 2);
    this.fbos.bloomLuminance = this._createFBO(bloomW, bloomH);
    this.fbos.bloomBlurH = this._createFBO(bloomW, bloomH);
    this.fbos.bloomBlurV = this._createFBO(bloomW, bloomH);
    this.fbos.preBloom = this._createFBO(this.width, this.height);
  }

  _resizeFramebuffers() {
    const gl = this.gl;
    const resize = (fboData, w, h) => {
      gl.bindTexture(gl.TEXTURE_2D, fboData.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        w,
        h,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null
      );
      fboData.width = w;
      fboData.height = h;
    };

    resize(this.fbos.flow.read, this.width, this.height);
    resize(this.fbos.flow.write, this.width, this.height);
    resize(this.fbos.cascade.read, this.width, this.height);
    resize(this.fbos.cascade.write, this.width, this.height);
    resize(this.fbos.lines, this.width, this.height);
    resize(this.fbos.preBloom, this.width, this.height);
    // Bloom at half res
    const bloomW = Math.floor(this.width / 2);
    const bloomH = Math.floor(this.height / 2);
    resize(this.fbos.bloomLuminance, bloomW, bloomH);
    resize(this.fbos.bloomBlurH, bloomW, bloomH);
    resize(this.fbos.bloomBlurV, bloomW, bloomH);
  }

  async _loadLogo() {
    if (!this.config.logoUrl) return;

    return new Promise((resolve) => {
      this.logoImage = new Image();
      this.logoImage.crossOrigin = "anonymous"; // Required for Webflow/CDN images
      this.logoImage.onload = () => {
        this._createLogoTexture();
        resolve();
      };
      this.logoImage.onerror = () => {
        console.warn("Failed to load logo, using fallback");
        resolve();
      };
      this.logoImage.src = this.config.logoUrl;
    });
  }

  _createLogoTexture() {
    const gl = this.gl;
    const img = this.logoImage;
    if (!img || !img.complete) return;

    // Get CSS pixel dimensions (not device pixels)
    const rect = this.container.getBoundingClientRect();
    const cssWidth = rect.width;
    const dpr = this.width / cssWidth;

    // Calculate scaled dimensions in CSS pixels, then scale to device pixels
    const maxWidth = Math.min(this.config.logoMaxWidth, cssWidth * 0.9);
    const scale = maxWidth / img.width;
    const logoW = img.width * scale * dpr;
    const logoH = img.height * scale * dpr;
    const x = (this.width - logoW) / 2;

    // Draw to offscreen canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = this.width;
    offscreen.height = this.height;
    const ctx = offscreen.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.config.logoPosition === "footer") {
      // Footer: clip top of logo, align to bottom
      const clipTop = this.config.logoClipTop * scale * dpr;
      const clippedH = logoH - clipTop;
      const y = this.height - clippedH;
      // drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      ctx.drawImage(
        img,
        0,
        this.config.logoClipTop, // source x, y (clip from top)
        img.width,
        img.height - this.config.logoClipTop, // source width, height
        x,
        y, // dest x, y
        logoW,
        clippedH // dest width, height
      );
    } else {
      // Hero: align to top, no padding
      ctx.drawImage(img, x, 0, logoW, logoH);
    }

    // Create or update texture
    if (!this.logoTexture) {
      this.logoTexture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this.logoTexture);
    // Flip Y for WebGL coordinate system
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      offscreen
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _bindEvents() {
    // Mouse/touch tracking
    const updateMouse = (x, y) => {
      const rect = this.canvas.getBoundingClientRect();
      this.prevMouse.x = this.mouse.x;
      this.prevMouse.y = this.mouse.y;
      this.mouse.x = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      // Flip Y for WebGL coordinate system (0 = bottom, 1 = top)
      this.mouse.y =
        1.0 - Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    };

    this.canvas.addEventListener("mouseenter", () => {
      this.mouseInBounds = true;
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.mouseInBounds = false;
    });
    this.canvas.addEventListener("mousemove", (e) =>
      updateMouse(e.clientX, e.clientY)
    );
    this.canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        this.mouseInBounds = true;
        const touch = e.touches[0];
        updateMouse(touch.clientX, touch.clientY);
      },
      { passive: false }
    );
    this.canvas.addEventListener("touchend", () => {
      this.mouseInBounds = false;
    });

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => {
      this._updateSize();
      if (this.gl) {
        this.gl.viewport(0, 0, this.width, this.height);
        this._resizeFramebuffers();
        this._createLogoTexture();
      }
    });
    this._resizeObserver.observe(this.container);

    // Intersection observer - pause when not visible
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this._onEnterViewport();
          } else {
            this._onLeaveViewport();
          }
        });
      },
      { threshold: 0.1 }
    );
    this._intersectionObserver.observe(this.container);
  }

  _onEnterViewport() {
    if (!this.running && this._wasRunning !== false) {
      this.start();
    }
  }

  _onLeaveViewport() {
    this._wasRunning = this.running;
    if (this.running) {
      this.stop();
    }
  }

  _updateVelocity() {
    // Decay velocity when mouse is out of bounds
    if (!this.mouseInBounds) {
      this.smoothVelocity.x *= 0.9;
      this.smoothVelocity.y *= 0.9;
      return;
    }

    const dx = this.mouse.x - this.prevMouse.x;
    const dy = this.mouse.y - this.prevMouse.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const hasMotion = mag > 0.01;

    if (hasMotion) {
      const targetX = dx / mag;
      const targetY = dy / mag;
      this.smoothVelocity.x += (targetX - this.smoothVelocity.x) * 0.3;
      this.smoothVelocity.y += (targetY - this.smoothVelocity.y) * 0.3;
    } else {
      this.smoothVelocity.x *= 0.975;
      this.smoothVelocity.y *= 0.975;
    }
  }

  _setUniforms(prog, uniforms) {
    const gl = this.gl;
    const locs = prog.uniforms;

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = locs[name];
      if (loc === undefined) continue;

      if (typeof value === "number") {
        gl.uniform1f(loc, value);
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
      } else if (value && value.texture !== undefined) {
        // It's a texture unit reference
        gl.uniform1i(loc, value.unit);
      }
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

    const gl = this.gl;
    this.time = (performance.now() - this.startTime) / 1000;
    this._updateVelocity();

    const cfg = this.config;

    // Flow pass
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

    // Cascade pass
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

    // Lines pass
    this._renderPass(this.programs.lines, this.fbos.lines, {
      uTexture: this._bindTexture(this.fbos.cascade.read.texture, 0),
      uFlow: this._bindTexture(this.fbos.flow.read.texture, 1),
      time: this.time,
      resolution: [this.width, this.height],
      spacing: cfg.lines.spacing,
      thick: cfg.lines.thick,
    });

    // Pre-bloom output pass (render scene to FBO for bloom input)
    this._renderPass(this.programs.output, this.fbos.preBloom, {
      uTexture: this._bindTexture(this.fbos.cascade.read.texture, 0),
      uLines: this._bindTexture(this.fbos.lines.texture, 1),
      uFlow: this._bindTexture(this.fbos.flow.read.texture, 2),
      time: this.time,
    });

    // Bloom: luminance extraction
    this._renderPass(this.programs.bloomLuminance, this.fbos.bloomLuminance, {
      uTexture: this._bindTexture(this.fbos.preBloom.texture, 0),
      threshold: cfg.bloom.threshold,
      softKnee: cfg.bloom.softKnee,
    });

    // Bloom: horizontal blur
    const bloomW = this.fbos.bloomLuminance.width;
    const bloomH = this.fbos.bloomLuminance.height;
    this._renderPass(this.programs.bloomBlurH, this.fbos.bloomBlurH, {
      uTexture: this._bindTexture(this.fbos.bloomLuminance.texture, 0),
      resolution: [bloomW, bloomH],
      radius: cfg.bloom.radius,
    });

    // Bloom: vertical blur
    this._renderPass(this.programs.bloomBlurV, this.fbos.bloomBlurV, {
      uTexture: this._bindTexture(this.fbos.bloomBlurH.texture, 0),
      resolution: [bloomW, bloomH],
      radius: cfg.bloom.radius,
    });

    // Bloom composite (to screen)
    this._renderPass(this.programs.bloomComposite, null, {
      uScene: this._bindTexture(this.fbos.preBloom.texture, 0),
      uBloom: this._bindTexture(this.fbos.bloomBlurV.texture, 1),
      time: this.time,
      intensity: cfg.bloom.intensity,
      noiseScale: cfg.bloom.noiseScale,
    });

    //TO REMOVE IN PROD : Loop reset
    // if (this.time >= cfg.loopDuration) {
    //   this._clearFBOs();
    //   this.startTime = performance.now();
    //   this.smoothVelocity = { x: 0, y: 0 };
    // }

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
    clear(this.fbos.preBloom);
    clear(this.fbos.bloomLuminance);
    clear(this.fbos.bloomBlurH);
    clear(this.fbos.bloomBlurV);
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
      // Clean up WebGL resources
      Object.values(this.programs).forEach((p) => {
        if (p?.program) gl.deleteProgram(p.program);
      });
      if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
      if (this.logoTexture) gl.deleteTexture(this.logoTexture);
      // Delete FBOs and textures...
    }

    this.canvas?.remove();
  }

  setupGUI(gui) {
    if (!gui) return;

    const flowFolder = gui.addFolder("Flow");
    flowFolder.add(this.config.flow, "falloff", 0.3, 0.5, 0.01);
    flowFolder.add(this.config.flow, "alpha", 0.5, 1.0, 0.01);
    flowFolder.add(this.config.flow, "dissipation", 0.95, 0.999, 0.001);

    const cascadeFolder = gui.addFolder("Cascade");
    cascadeFolder.add(this.config.cascade, "copies_offset", -1.0, 1.0, 0.01);
    cascadeFolder.add(this.config.cascade, "grain", 0.2, 0.5, 0.01);
    cascadeFolder.add(this.config.cascade, "blend_delay", 0.0, 10.0, 0.01);
    cascadeFolder.add(this.config.cascade, "blend_factor", 0.0, 1.0, 0.01);

    const linesFolder = gui.addFolder("Lines");
    linesFolder.add(this.config.lines, "spacing", 8.0, 24.0, 0.5);
    linesFolder.add(this.config.lines, "thick", 0.1, 8.0, 0.01);

    const bloomFolder = gui.addFolder("Bloom");
    bloomFolder.add(this.config.bloom, "threshold", 0.0, 1.0, 0.01);
    bloomFolder.add(this.config.bloom, "softKnee", 0.0, 0.5, 0.01);
    bloomFolder.add(this.config.bloom, "radius", 0.5, 8.0, 0.1);
    bloomFolder.add(this.config.bloom, "intensity", 0.0, 2.0, 0.01);
    bloomFolder.add(this.config.bloom, "noiseScale", 0.01, 1.0, 0.01);
  }
}
