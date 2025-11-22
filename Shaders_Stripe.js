var stripeFrag = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform vec2 resolution;
uniform vec2 image_resolution;
uniform vec3 mouse;
uniform float time;
uniform sampler2D flowmap;
uniform sampler2D bloomTexture;

// Simple pseudo-random noise
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 spectrum(float x) {
        return (vec3( 1.220023e0,-1.933277e0, 1.623776e0)
          +(vec3(-2.965000e1, 6.806567e1,-3.606269e1)
          +(vec3( 5.451365e2,-7.921759e2, 6.966892e2)
          +(vec3(-4.121053e3, 4.432167e3,-4.463157e3)
          +(vec3( 1.501655e4,-1.264621e4, 1.375260e4)
          +(vec3(-2.904744e4, 1.969591e4,-2.330431e4)
          +(vec3( 3.068214e4,-1.698411e4, 2.229810e4)
          +(vec3(-1.675434e4, 7.594470e3,-1.131826e4)
          + vec3( 3.707437e3,-1.366175e3, 2.372779e3)
            *x)*x)*x)*x)*x)*x)*x)*x)*x;
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

float striped(vec2 uv, float size){
    vec2 _uv = fract(uv*vec2(size,16.));
    vec2 _size = vec2(size, 16.);
    vec2 ouv = vec2(floor(uv.x*_size.x)/_size.x, floor(uv.y*_size.x)/_size.y);
    vec3 sampled = texture(flowmap, ouv).rgb;
    float gray = sampled.b * .25;
    _uv += (sampled.rb ) * 0.5;
    return  smoothstep(gray, gray - 0.05, pow(abs(_uv.x-0.5), 4.));
}


float cells(vec2 uv){
    // Define grid resolution
    vec2 gridRes = vec2(resolution.x * 0.1, 32.0); 
    
    // Calculate grid cell coordinates (0 to 1 within each cell)
    vec2 cellUV = fract(uv * gridRes);
    
    vec2 cellIndex = floor(uv * gridRes) / gridRes;
    float gray = texture(flowmap, cellIndex).b; // Using blue channel as per your code
    vec2 p = cellUV - 0.5;
    float width = pow(gray, 1./2.); 
   
    float halfWidth = width * 0.5;
    float aa = 0.01; // Soft edge
    
    return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(p.x));
}


vec4 screen(vec4 src, vec4 dst, bool clamped) {
    if (!clamped) return vec4(1.0) - (vec4(1.0) - src) * (vec4(1.0) - dst);
    return clamp(vec4(1.0) - (vec4(1.0) - src) * (vec4(1.0) - dst), 0.0, 1.0);
}



const float spacing = 8.0;
const float thick = 4.0;

float to_stripe(float frag) {
    float saw = mod(frag, spacing) - 0.5 * spacing;
    float tri = abs(saw);
    tri = tri - 0.5 * thick;
    return clamp(tri, 0.0, 1.0);
}


float offstripe(vec2 uv) {
    
    float pixelSpacing = spacing / resolution.x; // Convert spacing from pixels to normalized space
    float x_pos = uv.x * resolution.x; // Convert normalized uv.x to pixel space
    float x_samp = x_pos - mod(x_pos, spacing);
    float x_samp_norm = x_samp / resolution.x; // Back to normalized uv

    vec2 sampleUV = vec2(x_samp_norm, uv.y);
    float bright = dot(texture(flowmap, sampleUV).rgb, vec3(0.57735)); // grayscale
    bright = clamp(bright, 0.0, 1.0);

    float perturbed_y = x_pos + spacing * bright + uv.x * 8.0;
    return to_stripe(perturbed_y);
}







void main() {
  vec2 uv = vTexCoord;
  
  vec2 slices = vec2(128.,24.);
  vec2 m = floor(uv*slices);
  float n = floor(uv.x*slices.x);
    
  vec3 fm = abs((texture(flowmap, uv).rgb-.5)*2.) ;
  
  vec3 tex = texture(flowmap,vec2(m/slices)).rgb;
 
  vec2 dist = vec2(6.1);
   vec2 off = ((fm.xy)*.65)*(pow(fm.z,2.)*0.125);

   float v = vec2(uv-(off*dist)).x;
   float salt = hash(uv * resolution);
    
   vec3 f = spectrum(fract(off.x*dist.x+salt*off.x*dist.x));
  
  
  vec4 flow = texture(flowmap,uv);
  float d = striped(uv, resolution.x * 0.1 );
  float h = cells(uv);
  float g = fm.b ;

  
  

  
  vec4 stripes = vec4(vec3(spectrum(h)),1.);
  fragColor = stripes * 8.;
}
`;
