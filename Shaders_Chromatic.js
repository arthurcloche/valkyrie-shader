var chromaticFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform vec2 mouse;
uniform sampler2D uTexture;
uniform float time;
uniform float s_1;
uniform float s_2;
uniform float s_3;
uniform float s_4;
uniform float s_5;
uniform float tile;
uniform float timeControler;
uniform vec2 resolution;

vec2 barrelDistortion(vec2 coord, float amt, float pos) {
    vec2 cc = coord - pos;
    float dist = dot(cc, cc);
    return coord + cc * dist * amt;
}

float sat( float t ){
    return clamp( t, 0.0, 1.0 );
}

float linterp( float t ) {
    return sat( 1.0 - abs( 2.0*t - 1.0 ) );
}

float remap( float t, float a, float b ) {
    return sat( (t - a) / (b - a) );
}

vec4 spectrum_offset( float t ) {
    vec4 ret;
    float lo = step(t,0.5);
    float hi = 1.0-lo;
    float w = linterp( remap( t, 1.0/6.0, 5.0/6.0 ) );
    ret = vec4(lo,1.0,hi, 1.) * vec4(1.0-w, w, 1.0-w, 1.);
    return ret;
}

vec4 adjustSaturation(vec4 color, float saturationFactor){
    float lum = dot(color.rgb, vec3(0.3333));
    color.rgb = mix(vec3(lum), color.rgb, saturationFactor);
    return color;
}

vec4 chromaticAbberation(vec2 uv, sampler2D tex, float power, float intensity, float pos){
    float max_distort = power;
    int num_iter = 100;
    float reci_num_iter_f = 1.0 / float(num_iter);

    vec4 sumcol = vec4(0.0);
    vec4 sumw = vec4(0.0);

    for (int i = 0; i < num_iter; ++i) {
        float t = pow(float(i) * reci_num_iter_f, 2.0);
        vec4 w = spectrum_offset(t);
        vec2 distortedUV = barrelDistortion(uv, intensity * max_distort * t, pos);
        sumw += w;
        sumcol += w * texture(tex, distortedUV);
    }

    vec4 outColor = sumcol / sumw;
    outColor = adjustSaturation(outColor, s_4);
    return outColor;
}

void main() {
    vec4 originalColor = texture(uTexture, vTexCoord);
    vec4 finalColor = chromaticAbberation( vTexCoord, uTexture, s_1, s_2, s_3 );
    vec4 finalRender = mix( originalColor, finalColor, s_5  );
    fragColor = finalRender;
}
`;

