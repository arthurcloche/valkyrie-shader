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
      width: "100%",
      height: "100%",
      ...options,
    };
    // p5 global width and height
    this.width = this.options.width || width;
    this.height = this.options.height || height;

    this.buffer = this._createBuffer();
  }

  _createBuffer() {
    // Default to FLOAT format if not specified, as used previously
    const settings = this.options.fboSettings || { format: FLOAT };
    const { width, height } = this.getSize();
    const opts = { ...settings, width, height };

    if (this.options.type === "pingpong") {
      return new SwapableTexture(opts);
    } else if (this.options.type === "single") {
      return createFramebuffer(opts);
    }
    return null; // 'screen' type
  }

  getSize() {
    // Helper to compute actual size based on the property and global p5 width/height
    function parseDimension(value, ref) {
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.includes("%")) {
        const pct = parseFloat(value) / 100;
        return pct * ref;
      }
      return ref; // fallback if value is not recognized
    }
    const widthVal = parseDimension(this.width, width);
    const heightVal = parseDimension(this.height, height);
    return { width: widthVal, height: heightVal };
  }

  update(uniforms = {}, drawCallback = null) {
    const target =
      this.options.type === "pingpong" ? this.buffer.src : this.buffer;

    const drawOps = () => {
      // Ensure we are using this shader
      shader(this.shader);
      const { width: w, height: h } = this.getSize();

      // Use ortho to ensure 1:1 pixel mapping and avoid perspective shrinking in feedback loops
      // When drawing to a framebuffer, the viewport matches the framebuffer size.
      // Using ortho with exactly the framebuffer dimensions maps coordinates -width/2..width/2 to the full buffer.
      ortho(-w / 2, w / 2, -h / 2, h / 2);

      // Default uniforms
      this.shader.setUniform("resolution", [w, h]);
      this.shader.setUniform("time", millis() / 1000.0);

      // Custom uniforms
      for (const key in uniforms) {
        this.shader.setUniform(key, uniforms[key]);
      }

      // Draw geometry
      if (drawCallback) {
        drawCallback();
      } else {
        plane(w, h);
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
