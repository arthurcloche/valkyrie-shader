var blurFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 resolution;
uniform vec2 direction;

// Standard Gaussian weights
const float weight[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main() {
  vec2 tex_offset = 1.0 / resolution * direction; 
  vec3 result = texture(uTexture, vTexCoord).rgb * weight[0]; 
  
  for(int i = 1; i < 5; ++i)
  {
     result += texture(uTexture, vTexCoord + vec2(tex_offset * float(i))).rgb * weight[i];
     result += texture(uTexture, vTexCoord - vec2(tex_offset * float(i))).rgb * weight[i];
  }
  
  fragColor = vec4(result, 1.0);
}
`;

var compositeFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform float strength;
uniform float radius;

uniform sampler2D blurTexture1;
uniform sampler2D blurTexture2;
uniform sampler2D blurTexture3;
uniform sampler2D blurTexture4;
uniform sampler2D blurTexture5;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}


float lerpBloomFactor(const in float factor) { 
    float mirrorFactor = 1.2 - factor;
    return mix(factor, mirrorFactor, radius);
}

void main() {
    vec3 bloom = vec3(0.0);
    float totalWeight = 0.0;
    
    // Sum the mips with weights
    // Weights can be adjusted to taste or use Unreal's factors
    // Unreal factors are roughly 1.0, 0.8, 0.6, 0.4, 0.2
    
    vec3 c1 = texture(blurTexture1, vTexCoord).rgb;
    vec3 c2 = texture(blurTexture2, vTexCoord).rgb;
    vec3 c3 = texture(blurTexture3, vTexCoord).rgb;
    vec3 c4 = texture(blurTexture4, vTexCoord).rgb;
    vec3 c5 = texture(blurTexture5, vTexCoord).rgb;
    
    float w1 = lerpBloomFactor(1.0);
    float w2 = lerpBloomFactor(0.8);
    float w3 = lerpBloomFactor(0.6);
    float w4 = lerpBloomFactor(0.4);
    float w5 = lerpBloomFactor(0.2);
    
    bloom = c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4 + c5 * w5;
    float salt = hash(gl_FragCoord.xy);
    bloom = bloom * strength + salt * bloom * 0.5 * strength;
    
    fragColor = vec4(bloom, 1.0);
}
`;
