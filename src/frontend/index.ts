import { mat4, ReadonlyVec3 } from 'gl-matrix';

const woodFrame = 'https://res.cloudinary.com/dponedhzq/image/upload/v1727418038/wood_frame_em8uwy.png';
const mainImage = 'https://res.cloudinary.com/dponedhzq/image/upload/v1727461946/art_shr_col54c.webp';

const canvas = document.querySelector('canvas');
const gl = canvas?.getContext('webgl2',{stencil:true});

function loadImage(str:string): Promise<HTMLImageElement>{
    const image = new Image();
    image.crossOrigin = "anonymous";
    return new Promise((resolve)=>{
        image.onload = () => {
            resolve(image);
          }
          
          image.src = str;
    });
}

function subdivideRectangle(divisions:number,gap = 0) {
    const data:number[] = [];
    const step = 1.0 / divisions;
    
    for (let i = 0; i < divisions; i++) {
        for (let j = 0; j < divisions; j++) {
            const x1 = -1 + 2 * i * step;
            const y1 = 1 - 2 * j * step;
            const x2 = -1 + 2 * (i + 1) * step - gap;
            const y2 = 1 - 2 * (j + 1) * step;


            const u1 = i * step;
            const u2 = (i + 1) * step;
            const v1 = 1.0 - j * step;  // 수정: v1이 이제 j * step (아래로 갈수록 증가)
            const v2 = 1.0 - (j + 1) * step;  // 수정: v2가 이제 (j + 1) * step

            const rowIndex = j;
            const columnIndex = i;

            // 첫 번째 삼각형
            data.push(x1, y1, 1.0, u1, v1,rowIndex, columnIndex);
            data.push(x2, y1, 1.0, u2, v1,rowIndex,columnIndex);
            data.push(x1, y2, 1.0, u1, v2,rowIndex,columnIndex);

            // 두 번째 삼각형
            data.push(x2, y1, 1.0, u2, v1,rowIndex,columnIndex);
            data.push(x2, y2, 1.0, u2, v2,rowIndex,columnIndex);
            data.push(x1, y2, 1.0, u1, v2,rowIndex,columnIndex);
        }
    }

    return new Float32Array(data); // Float32Array로 반환
}

function createPerspective(width:number,height:number){
    const perspective = mat4.create();
    {
        const fieldOfView = (45 * Math.PI) / 180;
        const aspect = width / height;
        const near = 0.1;
        const far = 100.0;
        mat4.perspective(perspective, fieldOfView, aspect, near, far);
    }
    return perspective;
}

function createView() {
    const view = mat4.create();
    {
        const eye:ReadonlyVec3 = [0,0,5];
        const target:ReadonlyVec3 = [0,0,0];
        const up:ReadonlyVec3 = [0,1,0];
        mat4.lookAt(view,eye,target,up);
    }
    return view;
}

function createTexture(gl: WebGL2RenderingContext, image: HTMLImageElement){
    const texture = gl.createTexture();
    if(!texture){
        return 0;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    

    return texture;
}

function setMVPUniforms(gl:WebGL2RenderingContext, shaderProgram:WebGLProgram, projectionMatrix:mat4, viewMatrix:mat4, modelMatrix:mat4) {
    const projectionUniformLocation = gl.getUniformLocation(shaderProgram, 'projection');
    const viewUniformLocation = gl.getUniformLocation(shaderProgram, 'view');
    const modelUniformLocation = gl.getUniformLocation(shaderProgram, 'model');

    gl.uniformMatrix4fv(projectionUniformLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(viewUniformLocation, false, viewMatrix);
    gl.uniformMatrix4fv(modelUniformLocation, false, modelMatrix);
}

const woodFrameVS = `#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;
out vec2 TexCoords;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

void main() {
    gl_Position = projection * view * model * vec4(aPos,1.0);
    TexCoords = aTexCoords;
}
`;
const woodFrameFS = `#version 300 es
precision highp float;
uniform sampler2D img;
in vec2 TexCoords;
out vec4 FragColor;

void main() {
    FragColor = texture(img,TexCoords);
}
`;

const shrFrameVS = `#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;
out vec2 TexCoords;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

void main() {
    gl_Position = projection * view * model * vec4(aPos,1.0);
    TexCoords = aTexCoords;
}`;
const shrFrameFS = `#version 300 es
precision highp float;
uniform sampler2D img;
uniform float translateY;
in vec2 TexCoords;
out vec4 FragColor;

void main() {
    FragColor = texture(img,TexCoords);
}
`;


const shrVS = `#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;
layout (location = 2) in float aRowIndex;
layout (location = 3) in float aColIndex;

out vec2 TexCoords;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

uniform float time;
uniform float noiseScale;
uniform float noiseStrength;

float random(float x) {
    return fract(sin(x) * 43758.5453);
}

float perlinNoise(float x) {
    float i = floor(x);
    float f = fract(x);

    float u = f * f * (3.0 - 2.0 * f);

    float a = random(i);
    float b = random(i + 1.0);

    return mix(a, b, u);
}

void main() {
    float speed = 0.001;
    float scaledTime = time * speed;

    float noiseValue = perlinNoise(aPos.y + scaledTime + aColIndex); 
    vec3 randomNoise = vec3(noiseValue, 0.0, 0.0) * 0.04;

    gl_Position = projection * view * model * vec4(aPos+randomNoise,1.0);
    TexCoords = aTexCoords;
}
`;
const shrFS = `#version 300 es
precision highp float;
uniform sampler2D img;
uniform float translateY;
in vec2 TexCoords;
out vec4 FragColor;

void main() {
    FragColor = texture(img,TexCoords);
}
`;

function createShader(gl:WebGL2RenderingContext,src:string, type: number) {
    const shader = gl.createShader(type);
    if(!shader){
        console.error('쉐이더 생성 실패!!');
        return 0;
    }

    gl.shaderSource(shader,src);
    gl.compileShader(shader);

    const isSuccess = gl.getShaderParameter(shader,gl.COMPILE_STATUS);
  
    if(!isSuccess){
      console.error('컴파일 실패!!!!!!!!!!!!!!!!!!');
      console.error(gl.getShaderInfoLog(shader));
      return 0;
    }
    
    return shader;
}

function createShaderProgram(gl:WebGL2RenderingContext,vs:string,fs:string){
    const vsShader = createShader(gl,vs,gl.VERTEX_SHADER);
    const fsShader = createShader(gl,fs,gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    if(!program){
        console.error('쉐이더 프로그램 생성 실패!!');
        return;
    }

    gl.attachShader(program,vsShader);
    gl.attachShader(program,fsShader);

    gl.linkProgram(program);

    gl.deleteShader(vsShader);
    gl.deleteShader(fsShader);

    const isSuccess = gl.getProgramParameter(program,gl.LINK_STATUS);
    if(!isSuccess){
        console.error('쉐이더 프로그램 링크 실패!');
        console.error(gl.getProgramInfoLog(program));
        return;
    }

    return program;
}

async function main() {
    if(!canvas){
        return;
    }
    const gl = canvas.getContext('webgl2');

    if(!gl){
        return;
    }

    const rect = canvas.getBoundingClientRect();

    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const [frameImage,shrImage] = await Promise.all([
        loadImage(woodFrame),
        loadImage(mainImage)
    ]);
    const data = subdivideRectangle(10);
    const shrData = subdivideRectangle(10,0.03);
    const vertexCount = 10 * 10 * 6;
    const perspective = createPerspective(canvasWidth,canvasHeight);
    const view = createView();


    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const fbt = Float32Array.BYTES_PER_ELEMENT;
    const stride = 7 * fbt;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,2,gl.FLOAT,false,stride,3*fbt);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2,1,gl.FLOAT,false,stride,5*fbt);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3,1,gl.FLOAT,false,stride,6*fbt);

    const shrVAO = gl.createVertexArray();
    const shrVBO = gl.createBuffer();
    gl.bindVertexArray(shrVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,shrVBO);
    gl.bufferData(gl.ARRAY_BUFFER,shrData,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,2,gl.FLOAT,false,stride,3*fbt);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2,1,gl.FLOAT,false,stride,5*fbt);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3,1,gl.FLOAT,false,stride,6*fbt);
    
    const woodFrameTexture = createTexture(gl,frameImage);
    const shrTexture = createTexture(gl,shrImage);

    const woodShaderProgram = createShaderProgram(gl,woodFrameVS,woodFrameFS);
    const shrShaderProgram = createShaderProgram(gl,shrFrameVS,shrFrameFS);
    const shrTearingProgram = createShaderProgram(gl,shrVS,shrFS);

    if(!woodShaderProgram || !shrShaderProgram || !shrTearingProgram){
        return;
    }

    const scale = mat4.create();
    mat4.scale(scale,scale,[1.0,1.0,1.0]);
    mat4.translate(scale,scale,[0,0.2,0]);
    
    let startTime = performance.now();
    
    let inputValue = 0;
    
    function calculateShrModel() {
        const shrModel = mat4.create();
        mat4.scale(shrModel,shrModel,[1.0,1.3,1.0]);
        mat4.translate(shrModel,shrModel,[0,0.2 -inputValue*0.01,-2.0]);
        return shrModel;
    }

    function calculateShrTearingModel() {
        const shrModel = mat4.create();
        mat4.scale(shrModel,shrModel,[1.0,1.3,1.0]);
        mat4.translate(shrModel,shrModel,[0,0.2 -inputValue*0.01,-2.1]);
        return shrModel;
    }

    const stencilModel = mat4.create();
    mat4.scale(stencilModel,stencilModel,[1.0,1.3,1.0]);
    mat4.translate(stencilModel,stencilModel,[0,0.2,-2.0]);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.enable(gl.STENCIL_TEST);
    gl.clearStencil(0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL);

    const animate = () => {
        let currentTime = performance.now();
        let elapsedTime = (currentTime - startTime); // 초 단위로 변환

        // 0~5초간 내려와함.

        inputValue = elapsedTime/50;

        if(inputValue > 100){
            inputValue = 100;
        }

        gl.enable(gl.STENCIL_TEST);
        gl.viewport(0,0,canvasWidth,canvasHeight);
        gl.clearColor(0.961,0.961,0.961,1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

        /*
        스텐실 마스크 그리기
        */
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.colorMask(false,false,false,false);
        gl.depthMask(false);


        gl.useProgram(shrShaderProgram);
        gl.bindVertexArray(vao);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, shrTexture);
        const shrTextureLocation = gl.getUniformLocation(shrShaderProgram, 'img');
        gl.uniform1f(shrTextureLocation,0);

        setMVPUniforms(gl,shrShaderProgram,perspective,view,stencilModel);
        gl.drawArrays(gl.TRIANGLES,0,vertexCount);
        // 스텐실 마스크 그리기 종료

        //상단 찢어지지 않은 부분 그리기
        gl.colorMask(true,true,true,true);
        gl.depthMask(true);
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
        setMVPUniforms(gl,shrShaderProgram,perspective,view,calculateShrModel());
        gl.drawArrays(gl.TRIANGLES,0,vertexCount);

        gl.disable(gl.STENCIL_TEST);
        //상단 찢어지지 않은 부분 완료

        // 잘려져서 흐물흐물
        gl.bindVertexArray(shrVAO);
        gl.useProgram(shrTearingProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,shrTexture);
        const location = gl.getUniformLocation(shrTearingProgram,'img');
        gl.uniform1f(location,0);

        const time = gl.getUniformLocation(shrTearingProgram, 'time');
        gl.uniform1f(time,elapsedTime);

        setMVPUniforms(gl,shrTearingProgram,perspective,view,calculateShrTearingModel());

        const translateYLocation = gl.getUniformLocation(shrTearingProgram,'translateY');
        gl.uniform1f(translateYLocation,inputValue * 0.01);

        gl.drawArrays(gl.TRIANGLES,0,vertexCount);
        // 잘려져서 흐물흐물 완료

        gl.bindVertexArray(vao);
        gl.useProgram(woodShaderProgram);
        setMVPUniforms(gl,woodShaderProgram,perspective,view,scale);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, woodFrameTexture);
        const textureLocation = gl.getUniformLocation(woodShaderProgram,'img');
        gl.uniform1i(textureLocation,0);

        gl.drawArrays(gl.TRIANGLES,0,vertexCount);
        requestAnimationFrame(animate);
    }

    animate();
}

main();
