const godRaysFrag = `#version 300 es
precision highp float;
precision highp int;

in vec3 vVertexPosition;
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uBgTexture;
uniform float uAmount;
uniform float uIntensity;
uniform float uExposure;
uniform float uDiffusion;
uniform int uPass;
uniform vec2 uPos;
uniform vec3 uTint;
uniform float uTime;

  uniform sampler2D uMaskTexture;
  uniform int uIsMask;
  uniform float uTrackMouse;
  uniform vec2 uMousePos;
  uniform vec2 uResolution;
  uniform float uParentTrackMouse;


const float PI2 = 6.28318530718;

float luma(vec4 color) {
  return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}

float interleavedGradientNoise(vec2 st) {
  return fract(52.9829189 * fract(dot(st, vec2(0.06711056, 0.00583715))));
}

vec4 godRays(vec2 st) {
  vec3 color = vec3(0);
  float decay = mix(0.89, 0.965, uAmount);
  vec2 pos = uPos - mix(vec2(0), (vec2(1. - uMousePos.x, 1. - uMousePos.y) - 0.5), uTrackMouse);
  float weight = 1.0;
  float MAX_ITERATIONS = 32.0;
  vec2 stepDir = (pos - st) / MAX_ITERATIONS * (0.25 + min(1., uAmount)) * 0.75;
  float noise = interleavedGradientNoise(st * uResolution);
  vec2 sampleUv = st + stepDir * noise;
  vec2 perpDir = vec2(-stepDir.y, stepDir.x);
  float intensity = 2.8 * uIntensity;

  for (float i = 0.0; i < MAX_ITERATIONS; i++) {
    float theta = i/MAX_ITERATIONS;
    sampleUv += stepDir + (perpDir * theta * sin((noise * 0.25) * (1.0 + theta) * 50.0)) * uDiffusion * 0.25;
    color += texture(uTexture, sampleUv).rgb * weight * intensity;
    weight *= decay;
    if(weight < 0.05) break;
  }
  
  return vec4(color / MAX_ITERATIONS, 1.0);
}

vec4 getBrightAreas(vec2 uv) {
  vec4 color = texture(uTexture, uv);
  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color = color * smoothstep(uExposure - 0.1, uExposure, lum);
  return color;
}

vec4 getGodRays(vec2 uv) {
  vec4 bg = texture(uBgTexture, uv);
  
  if(uIntensity <= 0.01) {
    return bg;
  }
  
  
  vec4 rays = godRays(uv);
  rays.rgb *= uTint;

  vec4 color;
  color.rgb = bg.rgb + rays.rgb;
  color.a = bg.a + rays.r;
  return color;
}

vec4 getColor(vec2 uv) {
  switch(uPass) {
    case 0: return getBrightAreas(uv); break;
    case 1: return getGodRays(uv); break;
  }
}

out vec4 fragColor;

void main() {	
  vec2 uv = vTextureCoord;
  vec4 color = getColor(uv);
  
  if(uPass == 1) {
    
  // #ifelseopen
  if(uIsMask == 1) {
    vec2 maskPos = mix(vec2(0), (uMousePos - 0.5), uParentTrackMouse);
    vec4 maskColor = texture(uMaskTexture, vTextureCoord - maskPos);
    color = color * (maskColor.a * maskColor.a);
  }
  // #ifelseclose
  
  fragColor = color;

  } else {
    fragColor = color;
  }
}`;
