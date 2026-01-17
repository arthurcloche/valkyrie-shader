/**
 * ValkyrieEffect - Extends Renderer with aurora/bloom effect
 */
class ValkyrieEffect extends Renderer {
  constructor(container, options = {}) {
    super(container);

    this.config = {
      aurora: {
        angle: 0.25,
        colorPosition: 1.33,
      },
      flow: {
        falloff: 0.35,
        alpha: 0.5,
        dissipation: 0.995,
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
        threshold: 0.3,
        softKnee: 0.5,
        radius: 4.0,
        intensity: 0.8,
        noiseScale: 0.25,
      },
      logoUrl: "",
      logoMaxWidth: 800,
      logoPosition: "hero",
      logoClipTop: 30,
      ...options,
    };

    this.init();
  }

  async setup() {
    // Create passes
    this.passes.aurora = this.createPass(auroraFrag);
    this.passes.flow = this.createPass(flowFrag, { pingPong: true });
    this.passes.cascade = this.createPass(cascadeFrag, { pingPong: true });
    this.passes.lines = this.createPass(linesFrag);
    this.passes.bloomLuminance = this.createPass(bloomLuminanceFrag, { scale: 0.5 });
    this.passes.bloomBlurH = this.createPass(bloomBlurHFrag, { scale: 0.5 });
    this.passes.bloomBlurV = this.createPass(bloomBlurVFrag, { scale: 0.5 });
    this.passes.output = this.createPass(outputFrag);
    // this.passes.composite = this.createPass(bloomCompositeFrag);

    // Load logo if provided
    if (this.config.logoUrl) {
      try {
        this.textures.logo = await this.loadTexture(this.config.logoUrl);
        this._createLogoTexture();
      } catch (e) {
        console.warn("Failed to load logo");
      }
    }
  }

  onResize() {
    this._createLogoTexture();
  }

  _createLogoTexture() {
    const logo = this.textures.logo;
    if (!logo?.image || !this.width || !this.height) return;

    const gl = this.gl;
    const img = logo.image;
    const dpr = this.dpr;
    const rect = this.container.getBoundingClientRect();

    const maxWidth = Math.min(this.config.logoMaxWidth, rect.width * 0.9);
    const scale = maxWidth / img.width;
    const logoW = Math.floor(img.width * scale * dpr);
    const logoH = Math.floor(img.height * scale * dpr);
    const x = Math.floor((this.width - logoW) / 2);

    if (!this._offscreenCanvas) {
      this._offscreenCanvas = document.createElement("canvas");
    }
    const offscreen = this._offscreenCanvas;
    offscreen.width = this.width;
    offscreen.height = this.height;
    const ctx = offscreen.getContext("2d");

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.config.logoPosition === "footer") {
      const clipTop = Math.floor(this.config.logoClipTop * scale * dpr);
      const clippedH = logoH - clipTop;
      const y = this.height - clippedH;
      ctx.drawImage(img, 0, this.config.logoClipTop, img.width, img.height - this.config.logoClipTop, x, y, logoW, clippedH);
    } else {
      ctx.drawImage(img, x, 0, logoW, logoH);
    }

    if (!this.textures.logoComposed) {
      this.textures.logoComposed = { texture: gl.createTexture() };
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures.logoComposed.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  draw() {
    const cfg = this.config;

    // Aurora
    const flow = this.passes.flow.render({
      uTexture: this.tex(this.passes.flow.texture),
      time: this.time,
      resolution: [this.width, this.height],
      falloff: cfg.flow.falloff,
      alpha: cfg.flow.alpha,
      dissipation: cfg.flow.dissipation,
      mouse: [this.mouse.x, this.mouse.y],
      velocity: [this.smoothVelocity.x, this.smoothVelocity.y],
    });

    const aurora = this.passes.aurora.render({
      time: this.time,
      resolution: [this.width, this.height],
      mouse: [this.mouse.x, this.mouse.y],
      angle: cfg.aurora.angle,
      colorPosition: cfg.aurora.colorPosition,
      uFlow : this.tex(flow.texture)
    });
    const lines = this.passes.lines.render({
      uTexture: this.tex(aurora.texture),
      uFlow: this.tex(flow.texture),
      time: this.time,
      resolution: [this.width, this.height],
      spacing: cfg.lines.spacing * this.dpr,
      thick: cfg.lines.thick * this.dpr,
    });

    this.passes.output.toScreen({
      uFlow: this.tex(flow.texture),
      uAurora: this.tex(aurora.texture),
      uLines: this.tex(lines.texture),
      time: this.time,
    });
    // Flow (ping-pong feedback)
    
    /*
    // Cascade (ping-pong feedback)
    const cascade = this.passes.cascade.render({
      uTexture: this.tex(this.passes.cascade.texture),
      img: this.tex(this.textures.logoComposed?.texture),
      time: this.time,
      resolution: [this.width, this.height],
      copies_offset: cfg.cascade.copies_offset,
      grain: cfg.cascade.grain,
      blend_delay: cfg.cascade.blend_delay,
      blend_factor: cfg.cascade.blend_factor,
    });

    // Lines
    const lines = this.passes.lines.render({
      uTexture: this.tex(cascade.texture),
      uFlow: this.tex(flow.texture),
      time: this.time,
      resolution: [this.width, this.height],
      spacing: cfg.lines.spacing * this.dpr,
      thick: cfg.lines.thick * this.dpr,
    });

    // Pre-bloom output
    const preBloom = this.passes.preBloom.render({
      uTexture: this.tex(cascade.texture),
      uLines: this.tex(lines.texture),
      uFlow: this.tex(flow.texture),
      time: this.time,
    });

    // Bloom: luminance extraction
    const bloomLum = this.passes.bloomLuminance.render({
      uTexture: this.tex(preBloom.texture),
      uLines: this.tex(lines.texture),
      threshold: cfg.bloom.threshold,
      softKnee: cfg.bloom.softKnee,
    });

    // Bloom: horizontal blur
    const bloomH = this.passes.bloomBlurH.render({
      uTexture: this.tex(bloomLum.texture),
      resolution: [bloomLum.width, bloomLum.height],
      radius: cfg.bloom.radius * this.dpr,
    });

    // Bloom: vertical blur
    const bloomV = this.passes.bloomBlurV.render({
      uTexture: this.tex(bloomH.texture),
      resolution: [bloomH.width, bloomH.height],
      radius: cfg.bloom.radius * this.dpr,
    });

    // Final composite to screen
    this.passes.composite.toScreen({
      uScene: this.tex(preBloom.texture),
      uBloom: this.tex(bloomV.texture),
      time: this.time,
      intensity: cfg.bloom.intensity,
      noiseScale: cfg.bloom.noiseScale,
    });
    */
  }

  setupGUI(gui) {
    if (!gui) return;

    const auroraFolder = gui.addFolder("Aurora");
    auroraFolder.add(this.config.aurora, "angle", 0.0, 1.0, 0.01);
    auroraFolder.add(this.config.aurora, "colorPosition", 0.0, 2.0, 0.001);

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
