const cascadeFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform vec2 resolution;
uniform vec2 image_resolution;
uniform sampler2D uTexture;
uniform sampler2D img;
uniform float time;

// Controls the vertical spacing between repetitions (0.0 = no space, 0.5 = half image height space)
const float spacing = 0.035; 

float repeat(float y){
    float canvasWidth = resolution.x;
    float imgWidth = image_resolution.x;
    float imgHeight = image_resolution.y;
    
    // Scale factor applied to image to fit canvas width
    float scale = canvasWidth / imgWidth;
    
    // Calculate the scaled height of the image on screen
    float scaledImgHeight = imgHeight * scale;
    
    // Add spacing to the effective height of each "cell"
    // Spacing is relative to the image height
    float cellHeight = scaledImgHeight * (1.0 + spacing);
    
    // How many cells fit in the canvas
    float repeats = resolution.y / cellHeight;
    
    // Map Y to cell coordinate system
    float val = y * repeats;
    
    // Get local coordinate within the cell (0..1)
    float localY = (val);
    
    // Adjust localY to account for spacing
    // We want the image to occupy the first 1/(1+spacing) portion of the cell
    // If spacing is 0.0, this factor is 1.0.
    float visiblePortion = 1.0 / (1.0 + spacing);
    
    // If we are in the spacing gap, return a value outside 0..1 (or clamp/discard)
    // But to keep it simple for texture sampling, we can map it.
    // Let's map the visible portion back to 0..1 for the texture
    
    if (localY > visiblePortion) {
        return -1.0; // Indicator for "gap"
    }
    
    return localY / visiblePortion;
}



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


vec2 fit(vec2 uv, vec2 resolution, vec2 imageResolution) {
    float canvasAspect = resolution.x / resolution.y;
    float imageAspect = imageResolution.x / imageResolution.y;
    
    vec2 scale = vec2(1.0);
    
    if (canvasAspect > imageAspect) {
        // Canvas is wider than image (Pillarbox)
        // We need to scale UV.x
        scale.x = canvasAspect / imageAspect;
    } else {
        // Canvas is taller than image (Letterbox)
        // We need to scale UV.y
        scale.y = imageAspect / canvasAspect;
    }
    
    // Center the UVs
    vec2 centeredUV = (uv - 0.5) * scale + 0.5;
    return centeredUV;
}

vec2 fitScaled(vec2 uv, vec2 resolution, vec2 imageResolution, float maxWidthPx) {
    float canvasAspect = resolution.x / resolution.y;
    float imageAspect = imageResolution.x / imageResolution.y;
    
    // Use 800px max, or 90% of canvas width if smaller
    float displayWidth = min(maxWidthPx, resolution.x * 0.9);
    float widthFrac = displayWidth / resolution.x;
    float heightFrac = widthFrac / imageAspect * canvasAspect;
    
    // Center horizontally, align top vertically
    float marginX = (1.0 - widthFrac) / 2.0;
    float marginY = 0.025;
    
    // Transform canvas UV to image UV
    vec2 imageUV;
    imageUV.x = (uv.x - marginX) / widthFrac;
    imageUV.y = (uv.y - marginY) / heightFrac;
    
    return imageUV;
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
    vec2 imgUV = fitScaled(uv, resolution, image_resolution, 800.0);
    bool inBounds = imgUV.x >= 0.0 && imgUV.x <= 1.0 && imgUV.y >= 0.0 && imgUV.y <= 1.0;
    vec3 samp = inBounds ? texture(img, imgUV).rgb : vec3(0.0);
    uv -= .5;
    
    float progress = ease(min(1.0, time / speed));
    float saltprogress = ease(min(1.0, time / grain_speed));
    float blend_progress = ease(min(1.0, time / blend_progress));
    float off = (-copies_offset * 0.1) * progress;
    float salt = hash13(vec3(gl_FragCoord.xy, 3.) + time * 500. + 50.) * 2.-1.;
    float salt2 = hash13(vec3(gl_FragCoord.xy * 256., 7.) + time * 1100. + 31.) * 2.-1.;
     
    uv += vec2(0.,off );
    uv *= vec2(1.-(spread_x/100.),1.-(spread_y/100.));
    uv -=  vec2(-salt2 * grain/10.,  salt * grain/10.) * (1.-saltprogress) * .5;
    uv += .5;
    
    vec3 prev = texture(uTexture, uv  ).rgb * (1.-fade) ;
    vec3 tint = tint(prev.x);
    vec3 color = mix(prev, samp, blend_progress);
    
    fragColor = vec4(color, alpha);
}
`;
