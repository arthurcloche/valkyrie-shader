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

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 tint(float value){
    return pal( value, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,0.5),vec3(0.8,0.90,0.30) );
}


float to_stripe(in float frag_y, in float bright) {
    float saw = mod(frag_y, spacing) - 0.5 * spacing;
    float tri = abs(saw);
    tri = tri - 0.5 * (1.-bright);
    return clamp(tri, 0.0, 1.0);
}

float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

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
    vec2 coords = vTexCoord;
    vec3 flow_rgb = texture(uFlow, coords).rgb;
    float flow = dot(flow_rgb, vec3(0.2126, 0.7152, 0.0722)); // sRGB luminance
    vec2 fragcoord = vTexCoord * resolution;
    float y_samp = fragcoord.y - mod(fragcoord.y, spacing);
    vec2 uv = vec2(fragcoord.x, y_samp)/resolution;
    float noi = snoise(uv * .0125 + flow + time);
    uv -= .5; 
    uv *= 1.+((noi * 2.) -1.)*.125;
    uv += .5;
    
    flow_rgb = texture(uFlow, coords).rgb;
    flow = dot(flow_rgb, vec3(0.2126, 0.7152, 0.0722));
    float bright = texture(uTexture, uv).r * 0.5 + flow* 0.5 ;
    bright = clamp(bright, 0.0, 1.0);
    float perturbed_y = fragcoord.y + spacing * bright;
    vec3 col = vec3(to_stripe(perturbed_y, bright + noi ));
    fragColor = vec4(vec3(1.-col.r), 1.);
    
}
`;
