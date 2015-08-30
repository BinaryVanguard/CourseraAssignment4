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

function calcIndices(verts) {
    var Indices = new Array(verts.length);

    for (var i = 0; i < verts.length; ++i)
        Indices[i] = i;

    return new Uint16Array(Indices);
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

//todo: refactor
function CreateCone(origin_point) {
    var cone = buildCone(origin_point, .2, 1, 1, 100, [0, 0, 1, 1]);
    cone.point_material = UniformMaterial(cone.point.points.length, vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), 50);
    cone.base_material = UniformMaterial(cone.base.points.length, vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), 50);
    
    cone.point_normals = calcNormals(cone.point.points, calcIndices(cone.point.points), gl.TRIANGLE_FAN);
    cone.base_normals = calcNormals(cone.base.points, calcIndices(cone.base.points), gl.TRIANGLE_FAN);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    var vNormals = gl.getAttribLocation(program, "vNormal");
    
    var pointVertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointVertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cone.point.points), gl.STATIC_DRAW);
    
    var pointNormBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointNormBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cone.point_normals), gl.STATIC_DRAW);

    var baseVertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, baseVertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cone.base.points), gl.STATIC_DRAW);

    var baseNormBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, baseNormBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cone.base_normals), gl.STATIC_DRAW);
           
    var pointMatBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointMatBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cone.point_material), gl.STATIC_DRAW);

    var baseMatBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, baseMatBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cone.base_material), gl.STATIC_DRAW);

    cone.render_point = function () {
        var vPosition = gl.getAttribLocation(program, "vPosition");
        var vNormals = gl.getAttribLocation(program, "vNormal");
        var vAmbi = gl.getAttribLocation(program, "vAmbi");
        var vDiff = gl.getAttribLocation(program, "vDiff");
        var vSpec = gl.getAttribLocation(program, "vSpec");
        var vAlpha = gl.getAttribLocation(program, "vAlpha");

        gl.bindBuffer(gl.ARRAY_BUFFER, pointVertBufferId);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, pointNormBufferId);
        gl.vertexAttribPointer(vNormals, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, pointMatBufferId);
        gl.vertexAttribPointer(vAmbi, 4, gl.FLOAT, false, 64, 0);
        gl.vertexAttribPointer(vDiff, 4, gl.FLOAT, false, 64, 16);
        gl.vertexAttribPointer(vSpec, 4, gl.FLOAT, false, 64, 32);
        gl.vertexAttribPointer(vAlpha, 4, gl.FLOAT, false, 64, 48);

        gl.enableVertexAttribArray(vPosition);
        gl.enableVertexAttribArray(vNormals);
        gl.enableVertexAttribArray(vAmbi);
        gl.enableVertexAttribArray(vDiff);
        gl.enableVertexAttribArray(vSpec);
        gl.enableVertexAttribArray(vAlpha);

        var u_mL2W = gl.getUniformLocation(program, "mL2W");
        gl.uniformMatrix4fv(u_mL2W, false, flatten(cone.transform.buildL2W()));

        gl.drawArrays(gl.TRIANGLE_FAN, 0, cone.point.points.length);
    }

    cone.render_base = function () {
        var vPosition = gl.getAttribLocation(program, "vPosition");
        var vNormals = gl.getAttribLocation(program, "vNormal");
        var vAmbi = gl.getAttribLocation(program, "vAmbi");
        var vDiff = gl.getAttribLocation(program, "vDiff");
        var vSpec = gl.getAttribLocation(program, "vSpec");
        var vAlpha = gl.getAttribLocation(program, "vAlpha");

        gl.bindBuffer(gl.ARRAY_BUFFER, baseVertBufferId);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, baseNormBufferId);
        gl.vertexAttribPointer(vNormals, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, baseMatBufferId);
        gl.vertexAttribPointer(vAmbi, 4, gl.FLOAT, false, 64, 0);
        gl.vertexAttribPointer(vDiff, 4, gl.FLOAT, false, 64, 16);
        gl.vertexAttribPointer(vSpec, 4, gl.FLOAT, false, 64, 32);
        gl.vertexAttribPointer(vAlpha, 4, gl.FLOAT, false, 64, 48);

        gl.enableVertexAttribArray(vPosition);
        gl.enableVertexAttribArray(vNormals);
        gl.enableVertexAttribArray(vAmbi);
        gl.enableVertexAttribArray(vDiff);
        gl.enableVertexAttribArray(vSpec);
        gl.enableVertexAttribArray(vAlpha);

        var u_mL2W = gl.getUniformLocation(program, "mL2W");
        gl.uniformMatrix4fv(u_mL2W, false, flatten(cone.transform.buildL2W()));

        gl.drawArrays(gl.TRIANGLE_FAN, 0, cone.base.points.length);
    }

    cone.render = function () {
        cone.render_point();
        cone.render_base();
    }

    return cone;
}

//todo: refactor
function CreateCylinder(origin_point) {
    var cylinder = buildCylinder(origin_point, .2, 1, 10, 20, [0, 0, 1, 1]);    
    cylinder.top_material = UniformMaterial(cylinder.top.points.length, vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), 50);
    cylinder.bottom_material = UniformMaterial(cylinder.bottom.points.length, vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), 50);
    cylinder.side_material = UniformMaterial(cylinder.top.points.length, vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), vec4(1, 1, 1, 1), 50);

    cylinder.top_normals = calcNormals(cylinder.top.points, calcIndices(cylinder.top.points), gl.TRIANGLE_FAN);
    cylinder.bottom_normals = calcNormals(cylinder.bottom.points, calcIndices(cylinder.bottom.points), gl.TRIANGLE_FAN);
    cylinder.side_normals = [];

    for (var i = 0; i < cylinder.sides.length; ++i)
        cylinder.side_normals[i] = calcNormals(cylinder.sides[i].points, calcIndices(cylinder.sides[i].points), gl.TRIANGLE_STRIP);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    var vNormals = gl.getAttribLocation(program, "vNormal");

    var topVertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, topVertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.top.points), gl.STATIC_DRAW);

    var topNormBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, topNormBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.top_normals), gl.STATIC_DRAW);

    var topMatBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, topMatBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.top_material), gl.STATIC_DRAW);

    var bottomVertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bottomVertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.bottom.points), gl.STATIC_DRAW);

    var bottomNormBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bottomNormBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.bottom_normals), gl.STATIC_DRAW);

    var bottomMatBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bottomMatBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.bottom_material), gl.STATIC_DRAW);

    var sideVertBufferIds = [];
    var sideNormBufferIds = [];

    for (var i = 0; i < cylinder.sides.length; ++i) {
        sideVertBufferIds[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, sideVertBufferIds[i]);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.sides[i].points), gl.STATIC_DRAW);

        sideNormBufferIds[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, sideNormBufferIds[i]);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.side_normals[i]), gl.STATIC_DRAW);
    }

    var sideMatBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sideMatBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinder.side_material), gl.STATIC_DRAW);


    cylinder.render_top = function () {
        var vPosition = gl.getAttribLocation(program, "vPosition");
        var vNormals = gl.getAttribLocation(program, "vNormal");
        var vAmbi = gl.getAttribLocation(program, "vAmbi");
        var vDiff = gl.getAttribLocation(program, "vDiff");
        var vSpec = gl.getAttribLocation(program, "vSpec");
        var vAlpha = gl.getAttribLocation(program, "vAlpha");

        gl.bindBuffer(gl.ARRAY_BUFFER, topVertBufferId);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, topNormBufferId);
        gl.vertexAttribPointer(vNormals, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, topMatBufferId);
        gl.vertexAttribPointer(vAmbi, 4, gl.FLOAT, false, 64, 0);
        gl.vertexAttribPointer(vDiff, 4, gl.FLOAT, false, 64, 16);
        gl.vertexAttribPointer(vSpec, 4, gl.FLOAT, false, 64, 32);
        gl.vertexAttribPointer(vAlpha, 4, gl.FLOAT, false, 64, 48);

        gl.enableVertexAttribArray(vPosition);
        gl.enableVertexAttribArray(vNormals);
        gl.enableVertexAttribArray(vAmbi);
        gl.enableVertexAttribArray(vDiff);
        gl.enableVertexAttribArray(vSpec);
        gl.enableVertexAttribArray(vAlpha);

        var u_mL2W = gl.getUniformLocation(program, "mL2W");
        gl.uniformMatrix4fv(u_mL2W, false, flatten(cylinder.transform.buildL2W()));

        gl.drawArrays(gl.TRIANGLE_FAN, 0, cylinder.top.points.length);
    }

    cylinder.render_bottom = function () {
        var vPosition = gl.getAttribLocation(program, "vPosition");
        var vNormals = gl.getAttribLocation(program, "vNormal");
        var vAmbi = gl.getAttribLocation(program, "vAmbi");
        var vDiff = gl.getAttribLocation(program, "vDiff");
        var vSpec = gl.getAttribLocation(program, "vSpec");
        var vAlpha = gl.getAttribLocation(program, "vAlpha");

        gl.bindBuffer(gl.ARRAY_BUFFER, bottomVertBufferId);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bottomNormBufferId);
        gl.vertexAttribPointer(vNormals, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bottomMatBufferId);
        gl.vertexAttribPointer(vAmbi, 4, gl.FLOAT, false, 64, 0);
        gl.vertexAttribPointer(vDiff, 4, gl.FLOAT, false, 64, 16);
        gl.vertexAttribPointer(vSpec, 4, gl.FLOAT, false, 64, 32);
        gl.vertexAttribPointer(vAlpha, 4, gl.FLOAT, false, 64, 48);

        gl.enableVertexAttribArray(vPosition);
        gl.enableVertexAttribArray(vNormals);
        gl.enableVertexAttribArray(vAmbi);
        gl.enableVertexAttribArray(vDiff);
        gl.enableVertexAttribArray(vSpec);
        gl.enableVertexAttribArray(vAlpha);

        var u_mL2W = gl.getUniformLocation(program, "mL2W");
        gl.uniformMatrix4fv(u_mL2W, false, flatten(cylinder.transform.buildL2W()));

        gl.drawArrays(gl.TRIANGLE_FAN, 0, cylinder.bottom.points.length);
    }

    cylinder.render_side = function () {
        var vPosition = gl.getAttribLocation(program, "vPosition");
        var vNormals = gl.getAttribLocation(program, "vNormal");
        var vAmbi = gl.getAttribLocation(program, "vAmbi");
        var vDiff = gl.getAttribLocation(program, "vDiff");
        var vSpec = gl.getAttribLocation(program, "vSpec");
        var vAlpha = gl.getAttribLocation(program, "vAlpha");

        var u_mL2W = gl.getUniformLocation(program, "mL2W");
        gl.uniformMatrix4fv(u_mL2W, false, flatten(cylinder.transform.buildL2W()));

        gl.bindBuffer(gl.ARRAY_BUFFER, sideMatBufferId);
        gl.vertexAttribPointer(vAmbi, 4, gl.FLOAT, false, 64, 0);
        gl.vertexAttribPointer(vDiff, 4, gl.FLOAT, false, 64, 16);
        gl.vertexAttribPointer(vSpec, 4, gl.FLOAT, false, 64, 32);
        gl.vertexAttribPointer(vAlpha, 4, gl.FLOAT, false, 64, 48);

        gl.enableVertexAttribArray(vAmbi);
        gl.enableVertexAttribArray(vDiff);
        gl.enableVertexAttribArray(vSpec);
        gl.enableVertexAttribArray(vAlpha);

        for (var i = 0; i < cylinder.sides.length; ++i) {
            gl.bindBuffer(gl.ARRAY_BUFFER, sideVertBufferIds[i]);
            gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, sideNormBufferIds[i]);
            gl.vertexAttribPointer(vNormals, 4, gl.FLOAT, false, 0, 0);

            gl.enableVertexAttribArray(vPosition);
            gl.enableVertexAttribArray(vNormals);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, cylinder.sides[i].points.length);
        }
    }

    cylinder.render = function () {
        cylinder.render_top();
        cylinder.render_bottom();
        cylinder.render_side();
    }

    return cylinder;
}

function hookupControls() {
    var light_0_enable = document.getElementById("light_0_checkbox");
    light_0_enable.addEventListener("change", function (e) { light_enabled[0] = e.target.checked; });

    var light_1_enable = document.getElementById("light_1_checkbox");
    light_1_enable.addEventListener("change", function (e) { light_enabled[1] = e.target.checked; });
}

var cone;
var cylinder;
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
    
    cone = CreateCone(vec4());
    cone.transform.pos[0] = -1;

    cylinder = CreateCylinder(vec4());
    cylinder.transform.pos[0] = 1;

    //renderFan(cone.point, cone.transform);
    //renderFan(cone.base, cone.transform);

    //renderFan(cylinder.top, cylinder.transform);
    //renderFan(cylinder.bottom, cylinder.transform);
    //for (var i = 0; i < cylinder.sides.length; ++i) renderStrip(cylinder.sides[i], cylinder.transform);

    requestAnimationFrame(draw);
   
    hookupControls();
}

var lastTime = 0;
var LightPosition = [vec4(0, 0, 100, 1),
                      vec4(0, 0, 10, 1)];
var LightColor = [vec4(0, .3, .3, 1),
                  vec4(1, 0, 0, 1)];
var LightAmbi = [.1, 0]
var light_enabled = [true, true];
function draw(time) {
    var deltaT = (time - lastTime) / 1000;
    lastTime = time;

    //camera.rotate(90 * deltaT, [0, 1, 0]);
    //camera.move(vec3(0, 0, 1 * deltaT));

    LightPosition[0] = multMV(rotate(90 * deltaT, [0, 1, 0]), LightPosition[0]);
    LightPosition[1] = multMV(rotate(-45 * deltaT, [0, 1, 0]), LightPosition[1]);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var mFinal = mult(mPersp, camera.getMatrix());

    var u_mMVP = gl.getUniformLocation(program, "mMVP");
    gl.uniformMatrix4fv(u_mMVP, false, flatten(mFinal));

    var u_Cam = gl.getUniformLocation(program, "cam");
    gl.uniform4fv(u_Cam, flatten(vec4(camera.pos)));

    var u_lightPos = gl.getUniformLocation(program, "uLights[0].position");
    var u_lightColor = gl.getUniformLocation(program, "uLights[0].color");
    var u_lightambi = gl.getUniformLocation(program, "uLights[0].ambientCoef");

    gl.uniform4fv(u_lightPos, flatten(vec4()));
    gl.uniform4fv(u_lightColor, flatten(vec4(.1, .1, .1, .1)));
    gl.uniform1f(u_lightambi, .2);


    var sum = 1;
    for (var i = 0; i < LightPosition.length; ++i) {
        if (light_enabled[i]) {
            u_lightPos = gl.getUniformLocation(program, "uLights[" + sum + "].position");
            u_lightColor = gl.getUniformLocation(program, "uLights[" + sum + "].color");
            u_lightambi = gl.getUniformLocation(program, "uLights[" + sum + "].ambientCoef");

            gl.uniform4fv(u_lightPos, flatten(LightPosition[i]));
            gl.uniform4fv(u_lightColor, flatten(LightColor[i]));
            gl.uniform1f(u_lightambi, LightAmbi[i]);
            sum++;
        }
    }

    var u_nLights = gl.getUniformLocation(program, "nLights");
    gl.uniform1i(u_nLights, sum);

    //renderSquare();
    cone.render();
    cylinder.render();

    requestAnimationFrame(draw);
}

function renderStrip(strip, transform) {
    
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(strip.points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(strip.colors));

    var u_mL2W = gl.getUniformLocation(program, "mL2W");
    gl.uniformMatrix4fv(u_mL2W, false, flatten(transform.buildL2W()));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, strip.points.length);
}

function renderFan(fan, transform) {

    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(fan.points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(fan.colors));

    var u_mL2W = gl.getUniformLocation(program, "mL2W");
    gl.uniformMatrix4fv(u_mL2W, false, flatten(transform.buildL2W()));

    gl.drawArrays(gl.TRIANGLE_FAN, 0, fan.points.length);
}

function renderSquare(time) {
    //gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);

    var u_mL2W = gl.getUniformLocation(program, "mL2W");
    gl.uniformMatrix4fv(u_mL2W, false, flatten(mat4()));

    gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
}

window.addEventListener("load", init);