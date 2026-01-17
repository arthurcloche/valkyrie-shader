const auroraFrag = `#version 300 es
precision mediump float;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uCustomTexture;
uniform float uAngle;
uniform float uTime;
uniform float uColorPosition;
uniform vec2 uMousePos;
uniform vec2 uResolution;

out vec4 fragColor;

ivec2 customTexSize;
float customTexAspect;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float ITERATIONS = 36.0;

vec3 blend(int blendMode, vec3 src, vec3 dst) {
    return src + dst;
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

vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

vec3 Tonemap_Reinhard(vec3 x) {
    x *= 4.0;
    return x / (1.0 + x);
}

float sdEllipse(vec2 st, float r) {
    float a = length(st + vec2(0.0, r * 0.8)) - r;
    float b = length(st + vec2(0.0, -r * 0.8)) - r;
    return (a + b);
}

float getSdf(vec2 st, float iter, float md) {
    return sdEllipse(st, 0.6020);
}

vec2 turb(vec2 pos, float t, float it, float md, vec2 mPos) {
    mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
    float freq = mix(2.0, 15.0, 0.0800);
    float amp = 0.5000 * md;
    float xp = 1.4;
    float time = t * 0.1 + 0.0;
    for (float i = 0.0; i < 4.0; i++) {
        vec2 s = sin(freq * ((pos - mPos) * rot) + i * time + it);
        pos += amp * rot[0] * s / freq;
        rot *= mat2(0.6, -0.8, 0.8, 0.6);
        amp *= mix(1.0, max(s.y, s.x), 0.0000);
        freq *= xp;
    }
    return pos;
}

float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
    vec2 uv = vTextureCoord;
    vec4 bg = texture(uTexture, uv);

    // Query custom texture size/aspect (if available)
    if (2 == 0) {
        customTexSize = textureSize(uCustomTexture, 0);
        customTexAspect = float(customTexSize.x) / float(customTexSize.y);
    }

    vec3 pp = vec3(0.0);
    vec3 bloom = vec3(0.0);

    float t = uTime * 0.5 + 0.0;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 mousePos = mix(vec2(0.0), uMousePos - 0.5, 0.1900);
    vec2 pos = uv * aspect - vec2(0.6190527508101805, 0.26407409845841157) * aspect;
    float mDist = length(uv * aspect - uMousePos * aspect);
    float md = mix(1.0, smoothstep(1.0, 5.0, 1.0 / mDist), 0.0);
    float rotation = uAngle * -2.0 * PI;
    mat2 rotMatrix = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
    pos = rotMatrix * pos;
    float bm = 0.05;
    vec2 prevPos = turb(pos, t, 0.0 - 1.0 / ITERATIONS, md, mousePos);
    float spacing = mix(1.0, TAU, 0.4600);
    float smoothing = 1.6500;

    for (float i = 1.0; i < ITERATIONS + 1.0; i++) {
        float iter = i / ITERATIONS;
        vec2 st = turb(pos, t, iter * spacing, md, mousePos);

        float d = abs(getSdf(st, iter, md));
        float pd = distance(st, prevPos);
        prevPos = st;
        float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;
        float ds = smoothstep(0.0, 0.4600 * bm + max(dynamicBlur * smoothing, 0.001), d);
        vec3 color = pal(
            iter * mix(0.1, 1.9, 0.6900) + uColorPosition,
            vec3(0.5),
            vec3(0.5),
            vec3(1.0),
            vec3(0.56, 0.78, 0.0)
        );
        float invd = 1.0 / max(d + dynamicBlur, 0.001);

        pp += (ds - 1.0) * color;
        bloom += clamp(invd, 0.0, 250.0) * color;
    }

    pp *= 1.0 / ITERATIONS;
    bloom = bloom / (bloom + 2e4);

    vec3 color = (-pp + bloom * 3.0 * 1.3900);
    color *= 1.2;
    color += (randFibo(gl_FragCoord.xy) - 0.5) / 255.0;
    color = Tonemap_Reinhard(color);

    vec4 auroraColor = vec4(color, 1.0);
    auroraColor.rgb = blend(1, bg.rgb, auroraColor.rgb);
    auroraColor = vec4(mix(bg.rgb, auroraColor.rgb, 1.1500), max(bg.a, luma(auroraColor.rgb)));

    fragColor = auroraColor;
}`;


#version 300 es
precision mediump float;

in vec3 vVertexPosition;
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uCustomTexture;
uniform vec2 uMousePos;
uniform vec2 uResolution;

out vec4 fragColor;

const float PI = 3.14159265359;

mat2 rot(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
}

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float screenPxRange(vec2 range) {
    vec2 unitRange = range / vec2(textureSize(uCustomTexture, 0));
    vec2 screenTexSize = vec2(1.0) / fwidth(vTextureCoord);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

float sdCustom(vec2 uv) {
    ivec2 customTexSize = textureSize(uCustomTexture, 0);
    float customTexAspect = float(customTexSize.x) / float(customTexSize.y);
    if (float(customTexSize.x) == float(uResolution.x) && float(customTexSize.y) == float(uResolution.y)) {
        return 1.0;
    }
    uv.x /= customTexAspect;
    uv += 0.5;
    vec4 sdColor = texture(uCustomTexture, uv);
    float msdf = median(sdColor.r, sdColor.g, sdColor.b);
    float m = 1.0 - sdColor.a;
    float sd = mix(msdf, sdColor.a, m);
    float screenPxDistance = screenPxRange(vec2(0.0833333)) * -(sd - 0.5);
    return screenPxDistance;
}

float getDistance(vec2 uv) {
    return sdCustom(uv);
}

float getDist(vec2 uv) {
    float sd = getDistance(uv);
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 mousePos = (uMousePos * aspect);
    float mouseDistance = length(vTextureCoord * aspect - mousePos);
    float falloff = smoothstep(0.0, 0.8, mouseDistance);
    float asd = 0.5;
    float md = mix(0.02 / falloff, 0.1 / falloff, -asd * sd);
    md = md * 1.5 * 0.0000;  // This results in 0, likely disabled or placeholder
    md = max(md, 0.0);
    sd -= md;
    return sd;
}

float screenPxRange() {
    vec2 unitRange = vec2(0.5);
    vec2 screenTexSize = vec2(1.0) / fwidth(vTextureCoord);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

vec4 refrakt(float sd, vec2 st, vec4 bg) {
    vec2 offset = mix(vec2(0), normalize(st) / sd, length(st));
    offset *= 3.0;
    vec4 r = vec4(0, 0, 0, 1);
    float rdisp = mix(0.01, 0.008, 0.9);
    float gdisp = mix(0.01, 0.01, 0.9);
    float bdisp = mix(0.01, 0.012, 0.9);
    vec2 uv = (vTextureCoord - 0.5) / mix(1.0, 4.0, 0.3) + 0.5;
    r.r = texture(uTexture, uv + offset * (1.0 - 0.5) * rdisp).r;
    r.g = texture(uTexture, uv + offset * (1.0 - 0.5) * gdisp).g;
    r.b = texture(uTexture, uv + offset * (1.0 - 0.5) * bdisp).b;
    float opacity = ceil(-sd);
    float smoothness = 0.005;
    opacity = smoothstep(0.0, smoothness, -sd);
    vec4 background = bg;
    return mix(background, r + vec4(vec3(0.4, 0.1, 1.0) / (-sd * 50.0), 1.0) * 0.0, opacity);
}

vec4 getEffect(vec2 st, vec4 bg) {
    float eps = 0.0005;
    float sd = getDist(st);
    float sd1 = getDist(st + vec2(eps, 0.0));
    float sd2 = getDist(st - vec2(eps, 0.0));
    float sd3 = getDist(st + vec2(0.0, eps));
    float sd4 = getDist(st - vec2(0.0, eps));
    vec4 r = refrakt(sd, st, bg);
    vec4 r1 = refrakt(sd1, st + vec2(eps, 0.0), bg);
    vec4 r2 = refrakt(sd2, st - vec2(eps, 0.0), bg);
    vec4 r3 = refrakt(sd3, st + vec2(0.0, eps), bg);
    vec4 r4 = refrakt(sd4, st - vec2(0.0, eps), bg);
    r = (r + r1 + r2 + r3 + r4) * 0.2;
    return r;
}

void main() {
    vec2 uv = vTextureCoord;
    vec4 bg = texture(uTexture, uv);
    vec4 color = vec4(1.0);
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 mousePos = mix(vec2(0.0), uMousePos - 0.5, 0.0);
    vec2 st = uv - (vec2(0.5, 0.5) + mousePos);
    st *= aspect;
    st *= 1.0 / (0.42 + 0.2);
    st *= rot(0.0 * 2.0 * PI);
    color = getEffect(st, bg);
    fragColor = color;
}