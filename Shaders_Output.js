const outputFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uFlow;
uniform sampler2D uLines;
uniform sampler2D uStroked;
uniform sampler2D uMask;
uniform float time;

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 tint(float value){
    return pal( value, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,0.5),vec3(0.8,0.90,0.30) );
}

vec4 clamped(vec4 render){
    return max( vec4(0.),min(vec4(1.), render));
}

void main() {
    vec2 uv = vTexCoord;
    float sampled = texture(uTexture, vTexCoord).r;
    float stroked = texture(uStroked, vTexCoord).r;
    float lined = texture(uLines, vTexCoord).r;
    float flow = texture(uFlow, vTexCoord).b;

    float render = lined * sampled * 2. + sampled + flow * lined ;
    
    vec3 colored =  mix( vec3(render),tint(render + 1. + uv.y * .5 + sin(time) * .25) , 1.-render) * 4.;
    vec3 toscreen =  mix( vec3(0.), colored, render);
    fragColor = vec4(toscreen, 1.);
}
`;
