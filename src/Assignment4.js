"use strict";

var canvas;
var gl;

var camera;
var mPersp;

var program;

function multMV(mat, vec) {
    var out = [];
    var retLength = vec.length;

    //less than ideal
    while (vec.length < 4)
        vec.push(0);
    mat = transpose(mat);
    out[0] = dot(mat[0], vec);
    out[1] = dot(mat[1], vec);
    out[2] = dot(mat[2], vec);
    out[3] = dot(mat[3], vec);

    return out.slice(0, retLength);
}

function RefFrame(pos, look, up) {
    var ref = {};

    ref.pos = (pos !== undefined) ? pos : vec3();
    ref.look = (look !== undefined) ? look : vec3(0, 0, -1);
    ref.up = (up !== undefined) ? up : vec3(0, 1, 0);

    ref.getMatrix = function () {
        return lookAt(this.pos, add(this.pos, this.look), this.up);
    }

    //todo - move always happens in world coordinates, never in local coordinates
    //it sholud be in local coordinates
    ref.move = function(vec) {
        if(vec === undefined)
            return;

        this.pos = add(this.pos, vec);
    }
    
    //todo - will need to update the up vector as well......
    ref.rotate = function (angle, axis) {
        if (angle === undefined || axis === undefined)
            return;

        var rot = rotate(angle, axis);
        this.look = multMV(rot, this.look);
    }

    return ref;
}

function normal(v0, v1, v2) {
    var one = subtract(v1, v0);
    var two = subtract(v2, v0);
    return normalize(cross(one, two));
}

function calcNormals(verts, indices, mode) {
    var normals = new Array(verts.length);
    var v0, v1, v2, v3, v4, surface;

    for (var i = 0; i < normals.length; ++i)
        normals[i] = vec4(0,0,0,0);
    
    //TODO - strip might not calculate normals properly, since the winding changes every other time.
    // what about fan? 

    if (mode === gl.TRIANGLE_STRIP) {
        for (var i = 0; i < indices.length - 2; ++i) {
            v0 = verts[indices[i]];
            v1 = verts[indices[i + 1]];
            v2 = verts[indices[i + 2]];
            
            v3 = subtract(v1, v0);
            v4 = subtract(v2, v0);

            surface = (i % 2 == 0) ? normalize(vec4(cross(v3, v4), 0)) : normalize(vec4(cross(v4, v3), 0));  // this is the actual surface normal;

            normals[indices[i]] = add(normals[indices[i]], surface);
            normals[indices[i + 1]] = add(normals[indices[i + 1]], surface);
            normals[indices[i + 2]] = add(normals[indices[i + 2]], surface);
        }
    }
    else if (mode === gl.TRIANGLE_FAN) {
        for (var i = 0; i < indices.length - 2; ++i) {
            v0 = verts[indices[0]];
            v1 = verts[indices[i + 1]];
            v2 = verts[indices[i + 2]];

            v3 = subtract(v1, v0);
            v4 = subtract(v2, v0);

            surface = normalize(vec4(cross(v3, v4), 0));  // this is the actual surface normal;

            normals[indices[i]] = add(normals[indices[i]], surface);
            normals[indices[i + 1]] = add(normals[indices[i + 1]], surface);
            normals[indices[i + 2]] = add(normals[indices[i + 2]], surface);
        }
    }
    else if (mode === gl.TRIANGLES) {
        for (var i = 0; i < indices.length; i += 3) {
            v0 = verts[indices[i]];
            v1 = verts[indices[i + 1]];
            v2 = verts[indices[i + 2]];

            v3 = subtract(v1, v0);
            v4 = subtract(v2, v0);

            surface = normalize(vec4(cross(v3, v4), 0));  // this is the actual surface normal;

            normals[indices[i]]     = add(normals[indices[i]], surface);
            normals[indices[i + 1]] = add(normals[indices[i + 1]], surface);
            normals[indices[i + 2]] = add(normals[indices[i + 2]], surface);
        }
    }

    for (var i = 0; i < normal.length; ++i)
        normals[i] = normalize(normals[i]);
    
    return normals;
}

function UniformMaterial(vertCount, a, d, s, alpha)
{
    var out = new Array(vertCount * 4);

    for (var i = 0; i < out.length; i+=4) {
        out[i] = a;
        out[i+1] = d;
        out[i+2] = s;
        out[i + 3] = [0, 0, 0, alpha]; //shininess coef
    }

    return out;
}

function oneOff() {

    var verts = [ vec4(0, -1, 0, 1),
                  vec4(1, 0, 0, 1),
                  vec4(-1, 0, 0, 1),
                  vec4( 0, 1, 0, 1),];

    //var verts = [vec4(0, 0, 1, 1),
    //             vec4(0, 0, 0, 1),
    //             vec4(0, 1, 0, 1)];

    //var verts = [vec4(0, 0, 1, 1),
    //             vec4(0, 0, -1, 1),
    //             vec4(1, 0, 0, 1)];

    //var colors = [1, 0, 0, 1,
    //              0, 1, 0, 1,
    //              0, 0, 1, 1];

    var material = UniformMaterial(verts.length, vec4(1,1,1,1), vec4(1,1,1,1), vec4(1, 1, 1, 1), 50);
    var indexData = new Uint16Array([0, 1, 2, 3]);

    //console.log(calcNormals(verts, indexData, gl.TRIANGLES));

    var normals = calcNormals(verts, indexData, gl.TRIANGLE_STRIP);

    var vertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var matBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, matBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(material), gl.STATIC_DRAW);

    var vAmbi = gl.getAttribLocation(program, "vAmbi");
    gl.vertexAttribPointer(vAmbi, 4, gl.FLOAT, false, 64, 0);
    gl.enableVertexAttribArray(vAmbi);

    var vDiff = gl.getAttribLocation(program, "vDiff");
    gl.vertexAttribPointer(vDiff, 4, gl.FLOAT, false, 64, 16);
    gl.enableVertexAttribArray(vDiff);

    var vSpec = gl.getAttribLocation(program, "vSpec");
    gl.vertexAttribPointer(vSpec, 4, gl.FLOAT, false, 64, 32);
    gl.enableVertexAttribArray(vSpec);

    var vAlpha = gl.getAttribLocation(program, "vAlpha");
    gl.vertexAttribPointer(vAlpha, 4, gl.FLOAT, false, 64, 48);
    gl.enableVertexAttribArray(vAlpha);

    var indexBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBufferId);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

    var normBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);

    var vNormals = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormals, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormals);
}

function init() {
    canvas = document.getElementById("gl-canvas");
    if (!canvas) {
        alert("Canvas not found");
        return;
    }

    gl = WebGLUtils.setupWebGL(canvas);

    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    camera = RefFrame(vec3(0, 0, 2));
    mPersp = perspective(75, canvas.width / canvas.height, 1, 1000);
    //mPersp = ortho(-1, 1, -1, 1, 1, -1);
    
    oneOff();

    requestAnimationFrame(render);
}

var lastTime = 0;
var LightPosition = vec4(0, 0, 100, 1);
function render(time) {
    var deltaT = (time - lastTime) / 1000;
    lastTime = time;

    //camera.rotate(90 * deltaT, [0, 1, 0]);
    //camera.move(vec3(0, 0, -1 * deltaT));

    LightPosition = multMV(rotate(90 * deltaT , [0, 1, 0]), LightPosition);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var mFinal = mult(mPersp, camera.getMatrix());

    var u_mMVP = gl.getUniformLocation(program, "mMVP");
    gl.uniformMatrix4fv(u_mMVP, false, flatten(mFinal));

    var u_Cam = gl.getUniformLocation(program, "cam");
    gl.uniform4fv(u_Cam, flatten(vec4(camera.pos)));

    var u_nLights = gl.getUniformLocation(program, "nLights");
    gl.uniform1i(u_nLights, 1);

    var u_light0Pos = gl.getUniformLocation(program, "uLights[0].position");
    gl.uniform4fv(u_light0Pos, flatten(LightPosition));

    var u_light0Color = gl.getUniformLocation(program, "uLights[0].color");
    gl.uniform4fv(u_light0Color, flatten(vec4(0, .5, .5, 1)));

    var u_light0ambi = gl.getUniformLocation(program, "uLights[0].ambientCoef");
    gl.uniform1f(u_light0ambi, .1);

    //gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);
    gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
}

window.addEventListener("load", init);