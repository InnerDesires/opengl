// Store modelData in a higher scope
let modelData = null;

async function main() {
    const canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl");
    if (gl === null) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    // Vertex shader program
    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec3 aVertexNormal;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uNormalMatrix;
        
        varying highp vec3 vLighting;
        
        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            
            // Apply lighting effect
            highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
            highp vec3 directionalLightColor = vec3(1, 1, 1);
            highp vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));
            
            highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);
            highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
            vLighting = ambientLight + (directionalLightColor * directional);
        }
    `;

    // Fragment shader program
    const fsSource = `
        precision highp float;
        varying highp vec3 vLighting;
        uniform float uTime;  // For animated effects
        uniform vec2 uResolution;  // Screen resolution
        
        // Pseudo-random function
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }
        
        void main() {
            vec4 baseColor = vec4(0.0, 0.3, 1.0, 1.0);
            vec2 uv = gl_FragCoord.xy / uResolution;
            
            // Create glitch blocks
            float block = floor(uv.x * uv.x*  666.0 * uv.x - 2.0 * uv.y * 666.0);
            float noise = random(vec2(block, floor(uTime * 1.0)));
            
            // Horizontal glitch displacement
            float glitchAmount = 0.1;
            vec2 displacement = vec2(noise * glitchAmount, 0.0);
            
            // Color shifting
            float r = baseColor.r;
            float g = baseColor.g;
            float b = baseColor.b;
            
            // RGB shift based on noise and time
            if (noise > 0.5) {
                // More aggressive color shifting
                r = baseColor.r + sin(uTime * 2.0) * 0.5;
                b = baseColor.b + cos(uTime * 3.0) * 0.5;
                
                // Add some green pulsing
                g = baseColor.g + sin(uTime * 4.0 + uv.y) * 0.3;
            }
            
            // Random color inversions
            if (noise > 0.95) {
                r = 1.0 - r;
                g = 1.0 - g;
                b = 1.0 - b;
            }
            
            // Apply displacement
            if (noise > 0.8) {
                uv += displacement;
            }
            
            // Create lighting glitches
            vec3 glitchedLighting = vLighting;
            if (noise > 0.7) {
                // Distort lighting
                glitchedLighting *= vec3(1.0 + sin(uTime * 10.0) * 0.5);
                // Sometimes create stark contrast
                if (noise > 0.9) {
                    glitchedLighting = step(0.5, glitchedLighting);
                }
            }
            
            vec4 glitchColor = vec4(r, g, b, 1.0);
            gl_FragColor = vec4(glitchColor.rgb * glitchedLighting, glitchColor.a);
        }
    `;

    // Initialize shader program
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
        },
        uniformLocations: {
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
            time: gl.getUniformLocation(shaderProgram, 'uTime'),
            resolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
        },
    };

    // Load STL file
    modelData = await loadSTLFile('punisher.stl');
    if (modelData) {
        modelData.vertices = normalizeModel(modelData.vertices);
        const buffers = initBuffers(gl, modelData.vertices, modelData.normals);
        let rotation = 0;

        function render() {
            const displayWidth = gl.canvas.clientWidth;
            const displayHeight = gl.canvas.clientHeight;
            
            // Set canvas resolution to 1/4 of the display size
            const scaleFactor = 8;
            const targetWidth = Math.floor(displayWidth / scaleFactor);
            const targetHeight = Math.floor(displayHeight / scaleFactor);
            
            if (gl.canvas.width !== targetWidth || gl.canvas.height !== targetHeight) {
                gl.canvas.width = targetWidth;
                gl.canvas.height = targetHeight;
                gl.viewport(0, 0, targetWidth, targetHeight);
            }
            
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, 45 * Math.PI / 180, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.1, 100.0);
            
            const modelViewMatrix = mat4.create();
            mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -6.0]);
            mat4.rotate(modelViewMatrix, modelViewMatrix, rotation, [0, 1, 0]);
            rotation += 0.005;

            drawScene(gl, programInfo, buffers, modelViewMatrix, projectionMatrix);
            requestAnimationFrame(render);
        }

        render();
    }
}

function initBuffers(gl, vertices, normals) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        normal: normalBuffer,
    };
}

function drawScene(gl, programInfo, buffers, modelViewMatrix, projectionMatrix) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    gl.useProgram(programInfo.program);

    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    // Set up normal attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
    
    // Calculate normal matrix
    const normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    // Set uniforms
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);
    gl.uniform1f(programInfo.uniformLocations.time, performance.now() / 1000.0);
    gl.uniform2f(programInfo.uniformLocations.resolution, gl.canvas.width, gl.canvas.height);
    
    // Draw all vertices from the STL file
    const vertexCount = modelData ? modelData.vertices.length / 3 : 0;
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Function to load and parse STL file
async function loadSTLFile(url) {
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return parseSTL(buffer);
    } catch (error) {
        console.error('Error loading STL file:', error);
        return null;
    }
}

// Function to parse STL binary format
function parseSTL(buffer) {
    const view = new DataView(buffer);
    const vertices = [];
    const normals = [];

    // Skip header (80 bytes) and get number of triangles (4 bytes)
    const triangleCount = view.getUint32(80, true);
    console.log(`Number of triangles in STL: ${triangleCount}`);
    
    let offset = 84; // Start after header and triangle count

    for (let i = 0; i < triangleCount; i++) {
        // Each triangle is 50 bytes: Normal (3 floats), Vertex1 (3 floats), Vertex2 (3 floats), Vertex3 (3 floats), Attribute count (2 bytes)
        
        // Read normal
        const normalX = view.getFloat32(offset, true);
        const normalY = view.getFloat32(offset + 4, true);
        const normalZ = view.getFloat32(offset + 8, true);
        
        // Read vertices
        for (let j = 0; j < 3; j++) {
            const vertexOffset = offset + 12 + (j * 12);
            const x = view.getFloat32(vertexOffset, true);
            const y = view.getFloat32(vertexOffset + 4, true);
            const z = view.getFloat32(vertexOffset + 8, true);
            
            vertices.push(x, y, z);
            normals.push(normalX, normalY, normalZ);
        }
        
        offset += 50; // Move to next triangle
    }

    console.log(`Parsed ${vertices.length / 3} vertices`);
    return {
        vertices: vertices,
        normals: normals
    };
}

// Example function to normalize model size
function normalizeModel(vertices) {
    // Find bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < vertices.length; i += 3) {
        minX = Math.min(minX, vertices[i]);
        maxX = Math.max(maxX, vertices[i]);
        minY = Math.min(minY, vertices[i + 1]);
        maxY = Math.max(maxY, vertices[i + 1]);
        minZ = Math.min(minZ, vertices[i + 2]);
        maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    // Calculate scale factor
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const scale = 10 / size; // Scale to fit in -1 to 1 range

    // Center and scale vertices
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i] = (vertices[i] - (minX + maxX) / 2) * scale;
        vertices[i + 1] = (vertices[i + 1] - (minY + maxY) / 2) * scale;
        vertices[i + 2] = (vertices[i + 2] - (minZ + maxZ) / 2) * scale;
    }

    return vertices;
}

// Make sure to call main as async
main().catch(console.error);