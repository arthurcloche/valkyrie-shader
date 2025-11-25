const outputFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uMask;
uniform float time;

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 tint(float value){
    return pal( value, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,0.5),vec3(0.8,0.90,0.30) );
}

void main() {
    vec4 sampled = texture(uTexture, vTexCoord);
    // float mask = sampled.r;
    // vec3 t = mask * 2. * mix(vec3(0.65, 0.1, 0.75), vec3(0.95, 0.1, 0.85),mask) ;
    // float progress = min(1., time / 3.5);
    // // Preserve black and white, tint grays (parabola peaks at 0.5)
    // float grayness = 4.0 * mask * (1.0 - mask);
    // t = mix(vec3(mask), t, grayness);
    // t = mix(t,vec3(mask), progress );
    fragColor = sampled;
}
`;
