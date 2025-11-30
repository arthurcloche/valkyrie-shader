class UnrealBloomPass {
  constructor(src, options = {}) {
    // Initial parameters
    this.strength = options.strength || 1.0;
    this.radius = options.radius || 0.95;
    this.threshold = options.threshold || 0.0;
    this.levels = options.levels || 5;

    // Shaders
    this.compositeMaterial = createShader(baseVert, compositeFrag);
    this.seperableBlurMaterials = [];

    for (let i = 0; i < this.levels; i++) {
      this.seperableBlurMaterials.push(createShader(baseVert, blurFrag));
    }

    // Render Targets (Mipmaps)
    this.renderTargetsHorizontal = [];
    this.renderTargetsVertical = [];
    this.nMips = this.levels;
    this.inputTexture = null;

    let resx = Math.round(width / 2);
    let resy = Math.round(height / 2);

    for (let i = 0; i < this.nMips; i++) {
      const renderTargetHoriz = createFramebuffer({
        width: resx,
        height: resy,
        format: FLOAT,
        textureFiltering: LINEAR,
      });

      const renderTargetVert = createFramebuffer({
        width: resx,
        height: resy,
        format: FLOAT,
        textureFiltering: LINEAR,
      });

      this.renderTargetsHorizontal.push(renderTargetHoriz);
      this.renderTargetsVertical.push(renderTargetVert);

      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }

    // We assume the input 'src' is a p5.Framebuffer or MipmapTexture
  }

  setSize(w, h) {
    let resx = Math.round(w / 2);
    let resy = Math.round(h / 2);

    for (let i = 0; i < this.nMips; i++) {
      this.renderTargetsHorizontal[i].resize(resx, resy);
      this.renderTargetsVertical[i].resize(resx, resy);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
  }

  render(srcTexture) {
    // 1. Downsample / Blur passes
    let inputTexture = srcTexture;
    this.inputTexture = srcTexture;

    for (let i = 0; i < this.nMips; i++) {
      const blurShader = this.seperableBlurMaterials[i];
      const rtHoriz = this.renderTargetsHorizontal[i];
      const rtVert = this.renderTargetsVertical[i];

      // Horizontal Pass
      rtHoriz.draw(() => {
        clear();
        shader(blurShader);
        blurShader.setUniform("uTexture", inputTexture);
        blurShader.setUniform("resolution", [rtHoriz.width, rtHoriz.height]);
        blurShader.setUniform("direction", [1.0, 0.0]);
        // Gaussian parameters can be tweaked per level if desired
        plane(rtHoriz.width, rtHoriz.height);
      });

      // Vertical Pass
      rtVert.draw(() => {
        clear();
        shader(blurShader);
        blurShader.setUniform("uTexture", rtHoriz.color);
        blurShader.setUniform("resolution", [rtVert.width, rtVert.height]);
        blurShader.setUniform("direction", [0.0, 1.0]);
        plane(rtVert.width, rtVert.height);
      });

      inputTexture = rtVert.color;
    }
  }

  // Function to get the composite bloom texture
  // Since we don't have a single texture that represents the sum yet,
  // we might need a composite pass that takes all 5 textures.
  // In p5/WebGL 2, we can bind multiple textures.

  composite(destination) {
    destination.draw(() => {
      clear();
      shader(this.compositeMaterial);
      this.compositeMaterial.setUniform("strength", this.strength);
      this.compositeMaterial.setUniform("radius", this.radius);

      // Bind all mip textures
      // Note: p5 setUniform handles sampler array binding if supported, or we name them blurTexture1, blurTexture2...
      this.compositeMaterial.setUniform(
        "blurTexture1",
        this.renderTargetsVertical[0].color
      );
      this.compositeMaterial.setUniform(
        "blurTexture2",
        this.renderTargetsVertical[1].color
      );
      this.compositeMaterial.setUniform(
        "blurTexture3",
        this.renderTargetsVertical[2].color
      );
      this.compositeMaterial.setUniform(
        "blurTexture4",
        this.renderTargetsVertical[3].color
      );
      this.compositeMaterial.setUniform(
        "blurTexture5",
        this.renderTargetsVertical[4].color
      );
      this.compositeMaterial.setUniform("input_texture", this.inputTexture);

      this.compositeMaterial.setUniform("time", millis() / 1000);

      plane(width, height);
    });
  }
}
