const linesFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uFlow;
uniform vec2 resolution;
uniform float time;

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 tint(float value){
    return pal( value, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,0.5),vec3(0.8,0.90,0.30) );
}

const float spacing = 16.0;
const float thick = 1.5;

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

void main() {
    vec2 coords = vTexCoord;
    vec2 fragcoord = vTexCoord * resolution;
    float y_samp = fragcoord.y - mod(fragcoord.y, spacing);
    vec2 uv = vec2(fragcoord.x, y_samp)/resolution;
    
    float bright = texture(uTexture, uv).r * 2. + texture(uFlow, uv).r * 2. ;
    bright = clamp(bright, 0.0, 1.0);
    float perturbed_y = fragcoord.y + spacing * bright;
    vec3 col = vec3(to_stripe(perturbed_y, bright * 2.));
    fragColor = vec4(vec3(1.-col.r), 1.);
    
}
`;
