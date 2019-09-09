var utils = require('./utils.js');
var uid = require('uid-safe')
class Mass {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.lastTime = new Date();
        this.forces = [];
        this.orbitParams = {};
        this.uid = uid.sync(8);
    }

    // adds a force to the mass's this.forces
    addForce(force) {
        this.forces.push(force);
    }

    // apply all forces in this.forces
    applyForces(timeStep) {
        if (this.forces.length > 0) {
            for (var i = 0; i < this.forces.length; i++) {
                this.vx += this.forces[i].x * timeStep;
                this.vy += this.forces[i].y * timeStep;
            }
        }
        this.forces = [];
    }

    // iterate one time step
    update() {
        var time = new Date();
        var timeStep = (time.getMilliseconds() - this.lastTime.getMilliseconds()) / 1000;
        if (timeStep < 0)
            timeStep += 1;

        this.lastTime = time;

        this.applyForces(timeStep);

        this.x += this.vx * timeStep;
        this.y += this.vy * timeStep;


        return this
    }

    // use this to iterate one specified timestep
    fixedUpdate(timeStep) {
        this.applyForces(timeStep);

        this.x += this.vx * timeStep;
        this.y += this.vy * timeStep;


        return this
    }

    // calculate the magnitute of two vectors
    magnitude(x1, y1, x2, y2) {
        var x = x2 - x1;
        var y = y2 - y1;
        return Math.sqrt(x * x + y * y);
    }

    rotatePoint(point, center, angle) {
        var rotatedX = Math.cos(angle) * (point.x - center.x) - Math.sin(angle) * (point.y - center.y) + center.x;
        var rotatedY = Math.sin(angle) * (point.x - center.x) + Math.cos(angle) * (point.y - center.y) + center.y;
        return { x: rotatedX, y: rotatedY };
    }


    // Calculates a list of coordinates of the Mass's hyperbolic orbit
    calculateHyperbolicOrbit(a, b, w, periapsis) {
        // drawing parameters
        var maxDrawSteps = 500;
        var drawStep = 100;
        var maxDrawDist = 50000;
        var dist = 0;
        var orbitPoints = [];
        var isClockwise = ((this.vx * this.y - this.vy * this.x) > 0 ? 1 : -1);

        // perapsis params
        var pX = -periapsis * Math.cos(w);
        var pY = periapsis * Math.sin(w);

        var deltaX = pX + a;
        var deltaY = pY;

        var startDist = this.magnitude(this.x, -this.y, 0, 0);
        var y = -isClockwise*10000;

        // loop until orbitPoints has grown too large or moved too far from the starting position
        while (orbitPoints.length < maxDrawSteps && dist < maxDrawDist) {
            var x = a * Math.sqrt(1 + (y * y) / (b * b));
            var orbitPos = { x, y };
            dist = this.magnitude(this.x, -this.y, x, y);

            if (!isNaN(x) && !isNaN(y)) {
                orbitPoints.push(orbitPos);
            }
            // iterate the time by the drawStep based on if the orbit is clockwise or not
            y += isClockwise * drawStep;
        }

        for (var i = 0; i < orbitPoints.length; i++) {
            var point = orbitPoints[i];
            point.x -= deltaX;
            point.y -= deltaY;

            orbitPoints[i] = this.rotatePoint(point, { x: -pX, y: -pY }, 2 * Math.PI - w);
        }

        if (this.magnitude(orbitPoints[0].x, orbitPoints[0].y, this.x, -this.y) < 500) {
            console.log("success!!");
            //console.log("phi: " + phi * 180 / Math.PI);
            console.log("w: " + w * 180 / Math.PI);
        }
        if (orbitPoints.length < 5) {
            console.log('failure!!');
            console.log('a: ' + a);
            console.log('b: ' + b);
            console.log('w: ' + w);
        }
        return orbitPoints;
    }

    calculateOrbit(mass) {
        // Parameters used in calculations
        // ecc = eccentricty vector
        // Ecc = magnitude of eccentricty vector
        // H = angular momentum
        // T = period
        // a = semiminor axis

        // Calculation of eccentricty vector
        var elipEcc = 1;
        var hypEcc = 1;
        var dist = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
        var speed = Math.sqrt(Math.pow(this.vx, 2) + Math.pow(this.vy, 2));
        var dotProduct = this.x * this.vx + this.y * this.vy;
        var ecc = {
            x: (speed * speed / mass - 1 / dist) * this.x - dotProduct / mass * this.vx,
            y: (speed * speed / mass - 1 / dist) * this.y - dotProduct / mass * this.vy
        };

        var Ecc = Math.sqrt(Math.pow(ecc.x, 2) + Math.pow(ecc.y, 2));

        var H = Math.abs(this.x * this.vy - this.y * this.vx);
        var a = 0, w = 0, b = 0, T = 0, theta = 0, periapsis = 0, apoapsis = 0;
        var orbitParams = {};

        // Calculate a, b, T, theta, w for Ellptical Orbits
        if (Ecc < elipEcc) {
            if (ecc.x !== 0) {
                w = Math.atan2(ecc.y, ecc.x);
            }
            else {
                w = Math.PI / 2;
            }
            a = H * H / (mass * (1 - Ecc * Ecc));
            b = a * Math.sqrt(1 - Ecc * Ecc);
            apoapsis = (1 - Ecc) * a;
            periapsis = (1 + Ecc) * a;
            T = 2 * Math.PI * Math.sqrt(a * a * a / mass);

            var dot = ecc.x * this.x + ecc.y * this.y;
            theta = Math.acos(dot / Ecc / dist);
            orbitParams.ellipse = {
                x: (a - apoapsis) * Math.cos(Math.PI - w),
                y: (a - apoapsis) * Math.sin(Math.PI - w),
                a: a,
                b: b,
                w: Math.PI - w
            };
        }
        // Calculate a, b, T, theta, w for Hyberbolic Orbits
        else if (Ecc > hypEcc) {
            a = H * H / (mass * (1.0 - Ecc * Ecc));
            b = a * Math.sqrt(Ecc * Ecc - 1.0);
            w = Math.atan2(ecc.y, ecc.x);
            T = 2 * Math.PI * Math.sqrt(-a * a * a / mass);
            var dot = ecc.x * this.x + ecc.y * this.y;

            // this is wrong T.T
            theta = Math.acos(dot / Ecc / dist);
            periapsis = (1 - Ecc) * a;
            orbitParams.points = this.calculateHyperbolicOrbit(a, b, w, periapsis);
        }

        orbitParams.speed = speed;
        orbitParams.periapsis = periapsis;
        orbitParams.apoapsis = apoapsis;
        orbitParams.theta = theta;
        orbitParams.T = T;
        orbitParams.w = w;
        orbitParams.Ecc = Ecc;
        orbitParams.ecc = ecc;
        orbitParams.vel = { x: this.vx, y: this.vy };
        orbitParams.pos = { x: this.x, y: this.y };

        return orbitParams;
    }
};
module.exports = Mass;
