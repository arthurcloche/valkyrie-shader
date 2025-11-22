p5.js shader hero section

We are going to make a 1.95/1 sized webgl canvas using p5.js, the canvas will have a fullwidth/height shader.

The shader will be the main part of this work. 

The shader will draw a row of line sdf and use a [0-1] to define the spacing between the lines, you can start with a uv.x gradient, so when pixels are darker the line are more spaced and when the pixels are lighter the lines are more packed.