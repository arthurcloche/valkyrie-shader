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

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
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
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = fract(vTexCoord); // Repeat the texture on both axes
  vec4 color = texture(uTexture, uv) * dissipation;

  // Apply wrapping to the cursor position
  vec2 cursor = vec2(mod(uv.x - fract(mouse.x-.5), 1.0),uv.y - (mouse.y-.5));
  
  // Adjust cursor to center it around (0.5, 0.5)
  cursor -= 0.5;
  cursor.x *= R.x / R.y;
  cursor += 0.5;

  // Blob distortion using simplex noise
  vec2 fromCenter = cursor - 0.5;
  float angle = atan(fromCenter.y, fromCenter.x);
  float dist = length(fromCenter);
  
  // Noise based on angle around the cursor, animated with time
  float noiseVal = snoise(vec2(angle * PI * 0.25, dist ) + time * 0.1 + length(velocity)) * 0.25;
  float blobDist = dist * (1.0 + noiseVal);

  vec3 stamp = vec3(velocity * vec2(1, -1),
                    1.0 - pow(1.0 - min(1.0, length(velocity)), 4.0))*1.;
  
  float falloff = smoothstep(falloff, 0.0, blobDist) * alpha;
  color.rgb = mix(color.rgb, stamp, vec3(falloff));
  
  fragColor = vec4(color.rgb, 1.0);
}
`;
