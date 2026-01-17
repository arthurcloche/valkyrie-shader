const fogFrag = `#version 300 es
  precision highp float;
  precision highp int;

  in vec3 vVertexPosition;
  in vec2 vTextureCoord;

  uniform sampler2D uTexture;
  uniform sampler2D uBgTexture;
  uniform float uDiffusion;
  uniform float uDensity;
  uniform float uTurbulence;
  uniform float uTime;
  uniform int uPass;
  uniform vec2 uPos;
  uniform float uPhase;
  uniform int uOctaves;
  uniform float uScale;
  uniform float uDrift;
  uniform float uAngle;
  uniform float uChromatic;
  uniform float uScatter;
  uniform float uLuminance;
  uniform int uBlendMode;
  uniform vec3 uTint;
  uniform float uMixRadius;
  uniform int uMixRadiusInvert;
  uniform int uEasing;

  
  uniform sampler2D uMaskTexture;
  uniform int uIsMask;
  uniform float uTrackMouse;
  uniform vec2 uMousePos;
  uniform vec2 uResolution;
  uniform float uParentTrackMouse;

  
  float ease (int easingFunc, float t) {
    switch(uEasing) {
      case 0: return t; break;
case 1: return t * t; break;
case 2: return t * (2.0 - t); break;
case 3: return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t; break;
case 4: return t * t * t; break;
case 5: return --t * t * t + 1.0; break;
case 6: return t < 0.5 ? 4.0 * t * t * t : (t - 1.0) * (2.0 * t - 2.0) * (2.0 * t - 2.0) + 1.0; break;
case 7: return t * t * t * t; break;
case 8: return 1.0 - (--t) * t * t * t; break;
case 9: return t < 0.5 ? 8.0 * t * t * t * t : 1.0 - 8.0 * (--t) * t * t * t; break;
case 10: return t * t * t * t * t; break;
case 11: return 1.0 + (--t) * t * t * t * t; break;
case 12: return t < 0.5 ? 16.0 * t * t * t * t * t : 1.0 + 16.0 * (--t) * t * t * t * t; break;
case 13: return 1.0 - sqrt(1.0 - t * t); break;
case 14: return sqrt((2.0 - t) * t); break;
case 15: return t < 0.5 ? (1.0 - sqrt(1.0 - 4.0 * t * t)) / 2.0 : (sqrt(-((2.0 * t) - 3.0) * ((2.0 * t) - 1.0)) + 1.0) / 2.0; break;
case 16: return t == 0.0 ? 0.0 : pow(2.0, 10.0 * (t - 1.0)); break;
case 17: return t == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t); break;
case 18: return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : t < 0.5 ? pow(2.0, (20.0 * t) - 10.0) / 2.0 : (2.0 - pow(2.0, -20.0 * t + 10.0)) / 2.0; break;
case 19: return 1.0 - cos((t * 3.141592654) / 2.0); break;
case 20: return sin((t * 3.141592654) / 2.0); break;
case 21: return -(cos(3.141592654 * t) - 1.0) / 2.0; break;
case 22: return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : -pow(2.0, 10.0 * t - 10.0) * sin((t * 10.0 - 10.75) * ((2.0 * 3.141592654) / 3.0)); break;
case 23: return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * ((2.0 * 3.141592654) / 3.0)) + 1.0; break;
case 24: return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : t < 0.5 ? -(pow(2.0, 20.0 * t - 10.0) * sin((20.0 * t - 11.125) * ((2.0 * 3.141592654) / 4.5))) / 2.0 : (pow(2.0, -20.0 * t + 10.0) * sin((20.0 * t - 11.125) * ((2.0 * 3.141592654) / 4.5))) / 2.0 + 1.0; break;
      default: return t; break;
    }
  }

  
  uvec2 pcg2d(uvec2 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.y * 1664525u + 1013904223u;
    v.y += v.x * v.x * 1664525u + 1013904223u;
    v ^= v >> 16;
    v.x += v.y * v.y * 1664525u + 1013904223u;
    v.y += v.x * v.x * 1664525u + 1013904223u;
    return v;
  }

  float randFibo(vec2 p) {
    uvec2 v = floatBitsToUint(p);
    v = pcg2d(v);
    uint r = v.x ^ v.y;
    return float(r) / float(0xffffffffu);
  }

  
  vec3 blend (int blendMode, vec3 src, vec3 dst) {
    
    if(blendMode == 0) {
      return src;
    }
  
    if(blendMode == 1) {
      return src + dst;
    }
  
    if(blendMode == 2) {
      return src - dst;
    }
  
    if(blendMode == 3) {
      return src * dst;
    }
  
    if(blendMode == 4) {
      return 1. - (1. - src) * (1. - dst);
    }
  
    if(blendMode == 5) {
      return vec3((dst.x <= 0.5) ? (2.0 * src.x * dst.x) : (1.0 - 2.0 * (1.0 - dst.x) * (1.0 - src.x)), (dst.y <= 0.5) ? (2.0 * src.y * dst.y) : (1.0 - 2.0 * (1.0 - dst.y) * (1.0 - src.y)), (dst.z <= 0.5) ? (2.0 * src.z * dst.z) : (1.0 - 2.0 * (1.0 - dst.z) * (1.0 - src.z)));
    }
  
    if(blendMode == 6) {
      return min(src, dst);
    }
  
    if(blendMode == 7) {
      return max(src, dst);
    }
  
    if(blendMode == 8) {
      return vec3((src.x == 1.0) ? 1.0 : min(1.0, dst.x / (1.0 - src.x)), (src.y == 1.0) ? 1.0 : min(1.0, dst.y / (1.0 - src.y)), (src.z == 1.0) ? 1.0 : min(1.0, dst.z / (1.0 - src.z)));
    }
  
    if(blendMode == 9) {
      return vec3((src.x == 0.0) ? 0.0 : (1.0 - ((1.0 - dst.x) / src.x)), (src.y == 0.0) ? 0.0 : (1.0 - ((1.0 - dst.y) / src.y)), (src.z == 0.0) ? 0.0 : (1.0 - ((1.0 - dst.z) / src.z)));
    }
  
    if(blendMode == 10) {
      return (src + dst) - 1.0;
    }
  
    if(blendMode == 11) {
      return vec3((src.x <= 0.5) ? (2.0 * src.x * dst.x) : (1.0 - 2.0 * (1.0 - src.x) * (1.0 - dst.x)), (src.y <= 0.5) ? (2.0 * src.y * dst.y) : (1.0 - 2.0 * (1.0 - src.y) * (1.0 - dst.y)),  (src.z <= 0.5) ? (2.0 * src.z * dst.z) : (1.0 - 2.0 * (1.0 - src.z) * (1.0 - dst.z)));
    }
  
    if(blendMode == 12) {
      return vec3((src.x <= 0.5) ? (dst.x - (1.0 - 2.0 * src.x) * dst.x * (1.0 - dst.x)) : (((src.x > 0.5) && (dst.x <= 0.25)) ? (dst.x + (2.0 * src.x - 1.0) * (4.0 * dst.x * (4.0 * dst.x + 1.0) * (dst.x - 1.0) + 7.0 * dst.x)) : (dst.x + (2.0 * src.x - 1.0) * (sqrt(dst.x) - dst.x))), (src.y <= 0.5) ? (dst.y - (1.0 - 2.0 * src.y) * dst.y * (1.0 - dst.y)) : (((src.y > 0.5) && (dst.y <= 0.25)) ? (dst.y + (2.0 * src.y - 1.0) * (4.0 * dst.y * (4.0 * dst.y + 1.0) * (dst.y - 1.0) + 7.0 * dst.y)) : (dst.y + (2.0 * src.y - 1.0) * (sqrt(dst.y) - dst.y))), (src.z <= 0.5) ? (dst.z - (1.0 - 2.0 * src.z) * dst.z * (1.0 - dst.z)) : (((src.z > 0.5) && (dst.z <= 0.25)) ? (dst.z + (2.0 * src.z - 1.0) * (4.0 * dst.z * (4.0 * dst.z + 1.0) * (dst.z - 1.0) + 7.0 * dst.z)) : (dst.z + (2.0 * src.z - 1.0) * (sqrt(dst.z) - dst.z))));
    }
  
    if(blendMode == 13) {
      return abs(dst - src);
    }
  
    if(blendMode == 14) {
      return src + dst - 2.0 * src * dst;
    }
  
    if(blendMode == 15) {
      return 2.0 * src + dst - 1.0;
    }
  
    if(blendMode == 16) {
      return vec3((src.x > 0.5) ? max(dst.x, 2.0 * (src.x - 0.5)) : min(dst.x, 2.0 * src.x), (src.x > 0.5) ? max(dst.y, 2.0 * (src.y - 0.5)) : min(dst.y, 2.0 * src.y), (src.z > 0.5) ? max(dst.z, 2.0 * (src.z - 0.5)) : min(dst.z, 2.0 * src.z));
    }
  
    if(blendMode == 17) {
      return vec3((src.x <= 0.5) ? (1.0 - (1.0 - dst.x) / (2.0 * src.x)) : (dst.x / (2.0 * (1.0 - src.x))), (src.y <= 0.5) ? (1.0 - (1.0 - dst.y) / (2.0 * src.y)) : (dst.y / (2.0 * (1.0 - src.y))), (src.z <= 0.5) ? (1.0 - (1.0 - dst.z) / (2.0 * src.z)) : (dst.z / (2.0 * (1.0 - src.z))));
    }
   
  }

  
  float getExponentialWeight(int index) {
    switch(index) {
        case 0: return 1.0000000000;
        case 1: return 0.7165313106;
        case 2: return 0.5134171190;
        case 3: return 0.3678794412;
        case 4: return 0.2636050919;
        case 5: return 0.1888756057;
        case 6: return 0.1353352832;
        case 7: return 0.0969670595;
        case 8: return 0.0694877157;
        default: return 0.0;
    }
  }

  

float hash31(vec3 p3) {
    p3  = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return -1.0 + 2.0 * fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(
        (p3.x + p3.y) * p3.z,
        (p3.x + p3.z) * p3.y,
        (p3.y + p3.z) * p3.x
    ));
}

float perlin_noise(vec3 p) {
    vec3 pi = floor(p);
    vec3 pf = p - pi;

    vec3 w = pf * pf * (3.0 - 2.0 * pf);

    float n000 = dot(pf - vec3(0.0, 0.0, 0.0), hash33(pi + vec3(0.0, 0.0, 0.0)));
    float n100 = dot(pf - vec3(1.0, 0.0, 0.0), hash33(pi + vec3(1.0, 0.0, 0.0)));
    float n010 = dot(pf - vec3(0.0, 1.0, 0.0), hash33(pi + vec3(0.0, 1.0, 0.0)));
    float n110 = dot(pf - vec3(1.0, 1.0, 0.0), hash33(pi + vec3(1.0, 1.0, 0.0)));
    float n001 = dot(pf - vec3(0.0, 0.0, 1.0), hash33(pi + vec3(0.0, 0.0, 1.0)));
    float n101 = dot(pf - vec3(1.0, 0.0, 1.0), hash33(pi + vec3(1.0, 0.0, 1.0)));
    float n011 = dot(pf - vec3(0.0, 1.0, 1.0), hash33(pi + vec3(0.0, 1.0, 1.0)));
    float n111 = dot(pf - vec3(1.0, 1.0, 1.0), hash33(pi + vec3(1.0, 1.0, 1.0)));

    float nx00 = mix(n000, n100, w.x);
    float nx01 = mix(n001, n101, w.x);
    float nx10 = mix(n010, n110, w.x);
    float nx11 = mix(n011, n111, w.x);

    float nxy0 = mix(nx00, nx10, w.y);
    float nxy1 = mix(nx01, nx11, w.y);

    float nxyz = mix(nxy0, nxy1, w.z);

    return nxyz;
}


  out vec4 fragColor;

  const int kernelSize = 36;
  mat2 rot(float a) {
    return mat2(cos(a),-sin(a),sin(a),cos(a));
  }

  vec3 Tonemap_ACES(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return (x * (a * x + b)) / (x * (c * x + d) + e);
  }

  vec3 chromatic_aberration(vec3 color, vec2 uv, float amount) {
    vec2 offset = normalize(vTextureCoord - 0.5) * amount / vec2(uResolution.x/uResolution.y, 1);
    vec4 left = texture(uTexture, uv - offset);
    vec4 right = texture(uTexture, uv + offset);

    color.r = left.r;
    color.b = right.b;

    return color;
  }

  const float PHI = 1.618033988;
  const float PI = 3.14159265359;

  float dot_noise(vec3 p) {
    const mat3 GOLD = mat3(
    -0.571464913, +0.814921382, +0.096597072,
    -0.278044873, -0.303026659, +0.911518454,
    +0.772087367, +0.494042493, +0.399753815);
    
    return dot(cos(GOLD * p), sin(PHI * p * GOLD));
  }

  float cheap_fbm(vec3 p) {
    mat2 rota = mat2(0.6, -0.8, 0.8,  0.6);
    float nos = 0.;
    float amp = 1. + uTurbulence * 10.;
    float xp = sqrt(2.);
    float halfxp = xp * 0.5;
    for(int i = 0; i < uOctaves; i++) {
      float theta = uTime * 0.05 + float(i);
      p.xy *= xp;
      p.xy += sin(rota * p.xy * xp + theta) * 0.2;
      float nz = dot_noise(vec3(p.xy * rota, p.z + theta));
      nos += nz * amp * rota[0][0];
      amp *= halfxp;
      rota *= mat2(0.6, -0.8, 0.8,  0.6);
    }
    nos *= 1./float(uOctaves);
    float density = -3. + uDensity * 6.;
    return smoothstep(-3., 3., nos + density);
  }

  float fnoise(vec2 uv) {
    float aspectRatio = uResolution.x/uResolution.y;
    vec2 aspect = vec2(aspectRatio, 1);
    
    float multiplier = 10.0 * (uScale / ((aspectRatio + 1.) / 2.));
    vec2 st = ((uv * aspect - uPos * aspect)) * multiplier * rot((uAngle - 0.125) * 2. * PI);

    vec2 mPos = uPos + mix(vec2(0), (uMousePos-0.5), uTrackMouse);
    vec2 pos = mix(uPos, mPos, floor(uMixRadius));
    float dist = ease(uEasing, max(0.,1.-distance(uv * aspect, mPos * aspect) * 4. * (1. - uMixRadius)));

    if (uMixRadiusInvert == 1) {
      dist = max(0., (0.5 - dist));
    }
    
    float time = uTime * 0.05;
    vec2 drift = vec2(time * 0.2) * 2.0 * uDrift;
    float fbm = cheap_fbm(vec3(st - drift, time)) * dist;
    fbm = fbm / (1. + fbm);
    return fbm;
  }

  vec4 ExponentialBlur(sampler2D tex, vec2 uv, vec2 direction) {
    vec4 color = vec4(0.0);
    float total_weight = 0.0;

    float fogNoise = fnoise(uv);
    float radius = 8.0 * fogNoise * max(uDiffusion, 0.1);
    radius = mix(0.01, 0.03, radius);

    vec2 dir = normalize(direction) / vec2(uResolution.x/uResolution.y, 1);

    vec4 center = texture(tex, uv);
    float center_weight = getExponentialWeight(0);
    color += center * center_weight;
    total_weight += center_weight;

    for (int i = 1; i <= 8; i++) {
      float weight = getExponentialWeight(i);
      float offset = radius * float(i) / 8.0;
      vec4 sample1 = texture(tex, uv + offset * dir);
      vec4 sample2 = texture(tex, uv - offset * dir);
      color += (sample1 + sample2) * weight;
      total_weight += 2.0 * weight;
    }
    
    float scatter = radius * 2.;
    color += (
      texture(tex, uv + scatter * dir) + 
      texture(tex, uv - scatter * dir)
    ) * 0.0694877157;

    return color / total_weight;
  }

  vec4 blur(vec2 uv, vec2 direction) {
    return ExponentialBlur(uTexture, uv, direction);
  }

  vec4 fogComposite(vec2 uv) {
    vec4 bg = texture(uBgTexture, uv);
    vec4 blur = texture(uTexture, uv);
    float aspectRatio = uResolution.x/uResolution.y;
    
    float fogNoise = fnoise(uv);
    float fogMask = clamp(fogNoise * 2., 0., 1.);

    vec3 grain = vec3(randFibo(uv + fogNoise));

    blur.rgb = chromatic_aberration(blur.rgb, uv, fogMask * 0.01 * uDiffusion * (uChromatic * 2.5));
    blur.rgb = Tonemap_ACES(blur.rgb * (uLuminance + 0.5)) + grain * 0.05;
    
    vec4 foggedBlur = vec4(blur.rgb * uTint, blur.a);
    foggedBlur.rgb += (uScatter * 0.25 * fogMask * uTint);
    
    // #ifelseopen
    if(uBlendMode > 0) {
      foggedBlur.rgb = blend(uBlendMode, bg.rgb, foggedBlur.rgb * fogMask);
    } else {
      foggedBlur = mix(bg, foggedBlur, fogMask);
    }
    // #ifelseclose
    
    return foggedBlur;
  }

  vec4 getColor(vec2 uv) {
    switch(uPass) {
      case 0: return blur(uv, vec2(1, 0)); break;
      case 1: return blur(uv, vec2(0, 1)); break;
      case 2: return blur(uv, vec2(1, 1)); break;
      case 3: return blur(uv, vec2(1, -1)); break;
      case 4: return fogComposite(uv); break;
      default: return texture(uTexture, uv);
    }
  }

  void main() {	
    vec2 uv = vTextureCoord;
    vec4 color = getColor(uv);

    
  // #ifelseopen
  if(uIsMask == 1) {
    vec2 maskPos = mix(vec2(0), (uMousePos - 0.5), uParentTrackMouse);
    vec4 maskColor = texture(uMaskTexture, vTextureCoord - maskPos);
    color = color * (maskColor.a * maskColor.a);
  }
  // #ifelseclose
  
  fragColor = color;

  }
`;
