class MipmapTexture extends p5.Texture {
  constructor(renderer, levels = 0, settings) {
    super(renderer, levels, settings);
    const gl = this._renderer.GL;
    if (this.glMinFilter === gl.LINEAR) {
      this.glMinFilter = gl.LINEAR_MIPMAP_LINEAR;
    }
  }

  setInterpolation(downScale, upScale) {
    super.setInterpolation(downScale, upScale);
  }

  _getTextureDataFromSource() {
    return this.src;
  }

  init() {
    const gl = this._renderer.GL;
    this.glTex = gl.createTexture();

    const texture = this.glTex;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 255, 255])
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  drawCanvas(buffer) {
    const gl = this._renderer.GL;
    const image = new Image();
    const texture = this.glTex;

    if (buffer) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        buffer.canvas
      );
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src =
        "https://cdn.shopify.com/s/files/1/0817/9308/9592/files/background-image.jpg?v=1720660332";
      image.addEventListener("load", function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image
        );
        gl.generateMipmap(gl.TEXTURE_2D);
      });
    }

    if (this.glMinFilter === gl.LINEAR) {
      this.glMinFilter = gl.LINEAR_MIPMAP_LINEAR;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  drawFBO(buffer) {
    const gl = this._renderer.GL;
    const texture = this.glTex;
    if (buffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.copyTexImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        0,
        0,
        buffer.width * buffer.pixelDensity(),
        buffer.height * buffer.pixelDensity(),
        0
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    if (this.glMinFilter === gl.LINEAR) {
      this.glMinFilter = gl.LINEAR_MIPMAP_LINEAR;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  update() {}
}
