var next_object_id = 1

function rotatePoint(p, r) {
    var x = dot(r[0], vec4(p));
    var y = dot(r[1], vec4(p));
    var z = dot(r[2], vec4(p));
    var w = dot(r[3], vec4(p));
    return [x, y, z, w];
}

function movePoint(p, t) {
    var x = p[0] + t[0];
    var y = p[1] + t[1];
    var z = p[2] + t[2];
    return [x, y, z, 1];
}

function buildTransform() {
    //function to build the Local to world transformation
    function l2w() {
        //bake transform
        var tran = translate(this.pos[0], this.pos[1], this.pos[2]);
        var rot_x = rotate(this.rot[0], [1, 0, 0]);
        var rot_y = rotate(this.rot[1], [0, 1, 0]);
        var rot_z = rotate(this.rot[2], [0, 0, 1]);
        var scale = scalem(this.scale, this.scale, this.scale);

        var l2w = mult(rot_z, scale);
        l2w = mult(rot_y, l2w);
        l2w = mult(rot_x, l2w);
        l2w = mult(tran, l2w);

        return l2w;
    }
    return {
        pos: [0, 0, 0],
        rot: [0, 0, 0],
        scale: 1,    //uniform scaling only!
        buildL2W: l2w
    }
}

function buildFan(middle, radius, height, segments, color) {
    var points = [];
    var tip = movePoint(middle, [0, height, 0]);
    points.push(tip);
    middle = movePoint(middle, [0, 0, radius]);
    //middle[2] += radius;

    points.push(middle);

    var circ_Seg = (360 / segments); //we have already pushed the first outside point

    var rot = rotate(circ_Seg, [0, 1, 0]);  //always create fans around the Y axis

    for (var i = 0; i < segments; ++i) {
        middle = rotatePoint(middle, rot);
        points.push(middle);
    }

    var colors = [];
    for (var i = 0; i < points.length; ++i)
        colors.push(color);

    return { points: points, colors: colors };
}

function buildStrip(first, second, height, sections, color) {
    var points = [];

    points.push(first);
    points.push(second);

    var increment = height / sections;

    for (var i = 0; i < sections; ++i) {
        first = movePoint(first, [0, increment, 0]);
        second = movePoint(second, [0, increment, 0]);
        points.push(first);
        points.push(second);
    }

    var colors = []
    for (var i = 0; i < points.length; ++i)
        colors.push(color);

    return { points: points, colors: colors };
}

function buildCone(origin, radius, height, latitude, longitude, color) {
    //build two fans
    var cone = { id: next_object_id++, type: "cone" };
    cone.transform = buildTransform();

    cone.point = buildFan(origin, radius, height, longitude, color);
    cone.base = buildFan(origin, radius, 0, longitude, color);

    return cone;
}

function buildCylinder(origin, radius, height, latitude, longitude, color) {
    //build a fan
    //build another fan
    //build triangle strips
    var cylinder = { id: next_object_id++, type: "cylinder" };
    cylinder.transform = buildTransform();

    cylinder.top = buildFan(movePoint(origin, [0, height, 0]), radius, 0, longitude, color);
    cylinder.bottom = buildFan(origin, radius, 0, longitude, color);
    cylinder.sides = [];

    for (var i = 0; i < longitude; ++i)
        cylinder.sides.push(buildStrip(cylinder.bottom.points[i + 1], cylinder.bottom.points[i + 2], height, latitude, color));

    return cylinder;
}