class SwapableTexture {
  constructor(options = {}) {
    this.src = createFramebuffer(options);
    this.dst = createFramebuffer(options);
  }

  swap() {
    [this.src, this.dst] = [this.dst, this.src];
  }
}

class ShaderPass {
  constructor(vert, frag, options = {}) {
    if (!vert || !frag) {
      console.error(
        "ShaderPass: Vertex or Fragment shader source is missing/undefined."
      );
    }
    this.shader = createShader(vert, frag);
    this.options = {
      type: "single", // 'single', 'pingpong', 'screen'
      ...options,
    };

    this.buffer = this._createBuffer();
  }

  _createBuffer() {
    // Default to FLOAT format if not specified, as used previously
    const settings = this.options.fboSettings || { format: FLOAT };

    if (this.options.type === "pingpong") {
      return new SwapableTexture(settings);
    } else if (this.options.type === "single") {
      return createFramebuffer(settings);
    }
    return null; // 'screen' type
  }

  update(uniforms = {}, drawCallback = null) {
    const target =
      this.options.type === "pingpong" ? this.buffer.src : this.buffer;

    const drawOps = () => {
      // Ensure we are using this shader
      shader(this.shader);

      // Default uniforms
      this.shader.setUniform("resolution", [width, height]);
      this.shader.setUniform("time", millis() / 1000.0);

      // Custom uniforms
      for (const key in uniforms) {
        this.shader.setUniform(key, uniforms[key]);
      }

      // Draw geometry
      if (drawCallback) {
        drawCallback();
      } else {
        plane(width, height);
      }
    };

    if (target) {
      target.draw(() => {
        clear();
        drawOps();
      });

      if (this.options.type === "pingpong") {
        this.buffer.swap();
      }
    } else {
      // Draw to screen
      drawOps();
    }
  }

  get output() {
    if (this.options.type === "pingpong") return this.buffer.dst;
    return this.buffer;
  }
}
