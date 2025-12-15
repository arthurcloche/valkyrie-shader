// Shared vertex shader
const baseVert = `#version 300 es
in vec4 aPosition;
out vec2 vTexCoord;
void main() {
  vTexCoord = aPosition.xy * 0.5 + 0.5;
  gl_Position = aPosition;
}
`;

// Flow/cursor interaction shader
const flowFrag = `#version 300 es
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
  vec2 uv = vTexCoord;
  vec4 color = texture(uTexture, uv) * dissipation;

  vec2 cursor = uv - mouse;
  cursor.x *= resolution.x / resolution.y;

  float angle = atan(cursor.y, cursor.x);
  float dist = length(cursor);
  
  vec2 loopCoord = vec2(cos(angle + time + velocity.y), sin(angle + time + velocity.x)) * 1.0;
  float noiseVal = snoise(loopCoord + dist + time * 0.1 + length(velocity)) * 0.125;
  float blobDist = dist * (1.0 + noiseVal);

  vec3 stamp = vec3(velocity * vec2(1, -1),
                    1.0 - pow(1.0 - min(1.0, length(velocity * (1.-blobDist))), 1.0)) * 1.;
  
  float fall = smoothstep(falloff, 0.0, blobDist) * alpha;
  color.rgb = mix(color.rgb, stamp, vec3(fall));
  
  fragColor = vec4(color.rgb, 1.0);
}
`;

// Cascade/feedback shader
const cascadeFrag = `#version 300 es
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

float ease(float t) {
    return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

float cubic(float t) {
    return t < 0.5
        ? 4.0 * t * t * t
        : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

float quartic(float t) {
    return t < 0.5
        ? 8.0 * t * t * t * t
        : 1.0 - pow(-2.0 * t + 2.0, 4.0) / 2.0;
}

float hash13(vec3 p3) {
    p3  = fract(p3 * .1031);
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
    float mixFactor = (t < blend_delay)
        ? blend_factor
        : mix(blend_factor, 1.0, min((t - blend_delay) / (blend_delay + 1.), 1.0));
    vec4 color = mix(prev, samp, ease(mixFactor));
    color = mix(color, samp, ease(max(0., min(1., t - (blend_delay * .75)))));
    fragColor = color;
}
`;

// Lines effect shader
const linesFrag = `#version 300 es
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

float to_stripe(in float frag_y, in float bright) {
    float saw = mod(frag_y, spacing) - 0.5 * spacing;
    float tri = abs(saw);
    tri = tri - 0.5 * (1.-bright);
    return clamp(tri, 0.0, 1.0);
}

void main() {
    vec2 coords = vTexCoord;
    vec3 flow_rgb = texture(uFlow, coords).rgb;
    float flow = flow_rgb.b;//dot(flow_rgb, vec3(0.2126, 0.7152, 0.0722));
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
}
`;

// Bloom luminance extraction
const bloomLuminanceFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float threshold;
uniform float softKnee;

void main() {
    vec3 color = texture(uTexture, vTexCoord).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float soft = luma - threshold + softKnee;
    soft = clamp(soft / (2.0 * softKnee + 0.0001), 0.0, 1.0);
    soft = soft * soft;
    float contribution = max(soft, step(threshold, luma));
    fragColor = vec4(color * contribution, 1.0);
}
`;

// Gaussian blur horizontal
const bloomBlurHFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 resolution;
uniform float radius;

void main() {
    vec2 texel = 1.0 / resolution;
    vec3 result = vec3(0.0);
    
    // 9-tap gaussian weights
    float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
    
    result += texture(uTexture, vTexCoord).rgb * weights[0];
    for (int i = 1; i < 5; i++) {
        vec2 offset = vec2(float(i) * radius, 0.0) * texel;
        result += texture(uTexture, vTexCoord + offset).rgb * weights[i];
        result += texture(uTexture, vTexCoord - offset).rgb * weights[i];
    }
    
    fragColor = vec4(result, 1.0);
}
`;

// Gaussian blur vertical
const bloomBlurVFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 resolution;
uniform float radius;

void main() {
    vec2 texel = 1.0 / resolution;
    vec3 result = vec3(0.0);
    
    float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
    
    result += texture(uTexture, vTexCoord).rgb * weights[0];
    for (int i = 1; i < 5; i++) {
        vec2 offset = vec2(0.0, float(i) * radius) * texel;
        result += texture(uTexture, vTexCoord + offset).rgb * weights[i];
        result += texture(uTexture, vTexCoord - offset).rgb * weights[i];
    }
    
    fragColor = vec4(result, 1.0);
}
`;

// Bloom composite with simplex noise + iridescent tint
const bloomCompositeFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float time;
uniform float intensity;
uniform float noiseScale;

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

vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

vec3 iridescent(float t) {
    return pal(t, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 0.5), vec3(0.8, 0.90, 0.30));
}

void main() {
    vec3 scene = texture(uScene, vTexCoord).rgb;
    vec3 bloom = texture(uBloom, vTexCoord).rgb;
    
    // Very zoomed simplex for smooth color variation
    float n = snoise(vTexCoord * noiseScale + time * 0.05) * 0.5 + 0.5;
    
    // Iridescent tint based on noise + position
    vec3 tint = iridescent(n + vTexCoord.y * 0.3 + time * 0.1);
    
    // Apply tint to bloom
    vec3 tintedBloom = bloom * tint;
    
    // Additive blend
    vec3 result = scene + tintedBloom * intensity;
    
    fragColor = vec4(result, 1.0);
}
`;

// Output/composite shader
const outputFrag = `#version 300 es
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

float ease(float t) {
    return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

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

    float render = lined * sampled * 1. + sampled + flow * lined;
    
    vec3 colored = mix(vec3(render), tint(render + 1. + uv.y * .5 + sin(time + uv.y) * .35), 1. - render) * 4.;
    vec3 toscreen = mix(vec3(0.), colored, render);
    float fadein = ease(min(1.0, time / 2.0));
    vec3 intro = mix(vec3(0.), toscreen, fadein);
    fragColor = vec4(ACES(intro * 2.), 1.);
}
`;
