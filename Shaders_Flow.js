var flowFrag = `#version 300 es
precision mediump float;

#define PI 3.14159265359
uniform float time;

uniform vec3 resolution;
in vec2 vTexCoord;
out vec4 fragColor;

#define R resolution
uniform sampler2D uTexture;
uniform float falloff;
uniform float alpha;
uniform float dissipation;
uniform vec2 mouse;
uniform vec2 velocity;
    
void main() {
  vec2 uv = fract(vTexCoord); // Repeat the texture on both axes
  vec4 color = texture(uTexture, uv) * dissipation;

  // Apply wrapping to the cursor position
  vec2 cursor = vec2(mod(uv.x - fract(mouse.x-.5), 1.0),uv.y - (mouse.y-.5));
  
  // Adjust cursor to center it around (0.5, 0.5)
  cursor -= 0.5;
  cursor.x *= R.x / R.y;
  cursor += 0.5;

  vec3 stamp = vec3(velocity * vec2(1, -1),
                    1.0 - pow(1.0 - min(1.0, length(velocity)), 4.0))*1.;
  
  float falloff = smoothstep(falloff, 0.0, length(cursor - 0.5)) * alpha;
  color.rgb = mix(color.rgb, stamp, vec3(falloff));
  
  fragColor = vec4(color.rgb, 1.0);
}
`;
