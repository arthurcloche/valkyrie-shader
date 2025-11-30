const cascadeFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D uTexture;
uniform sampler2D img;
uniform float time;

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 tint(float value){
    return pal( value, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(2.0,1.0,0.0),vec3(0.5,0.20,0.25) );
}

vec3 irri(float hue) {
  return .5+ .5 *cos(( 9.*hue)+ vec3(0,23.,21.));
}

float ease(float t) {
    return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

uniform float copies_offset; // 0.5
uniform float spread_x; // 0.75
uniform float spread_y; // 0.45
uniform float grain;  // .25
uniform float grain_strength; // 0.5
uniform float fade; // 0.05
uniform float alpha; // 0.2

uniform float speed; //3.
uniform float grain_speed; // 5.
uniform float blend_progress; // 5.5

void main() {
    vec2 uv = vTexCoord;
    float fadein = min(1.0, time / 3.0);
    vec4 tex = texture(img, uv);
    vec4 samp = mix(vec4(0.0), tex, fadein);
    uv -= .5;
    
    float progress = ease(min(1.0, time / 8.));
    float saltprogress = ease(min(1.0, time / grain_speed));
    float blend_progress = ease(min(1.0, time / 5.));
    float off = (-copies_offset * 0.075) * progress;
    float salt = hash13(vec3(gl_FragCoord.xy, 3.) + time * 500. + 50.) * 2.-1.;
    float salt2 = hash13(vec3(gl_FragCoord.xy * 256., 7.) + time * 1100. + 31.) * 2.-1.;
     
    float spreadx = mix(0.,0.1 ,ease(progress));


    
    uv *= vec2(0.9 + spreadx, .975);
    uv += vec2(0.,off );
    uv -=  vec2(-salt2 * grain/10.,  salt * grain/10.) * .25;
    uv += .5;
    
    vec4 prev = texture( uTexture, uv ) * 0.9975 ;
    
    float t = time;
    float d = 4.;
    float mixFactor = (t < d )
        ? 0.2
        : mix(0.2, 1.0, min((t -d) / ( d + 1. ), 1.0));
    vec4 color = mix(prev, samp, ease(mixFactor));
    
    fragColor = color;
}
`;
