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

    addForce(force) {
        this.forces.push(force);
    }

    applyForces(timeStep) {
        if (this.forces.length > 0) {
            for (var i = 0; i < this.forces.length; i++) {
                this.vx += this.forces[i].x * timeStep;
                this.vy += this.forces[i].y * timeStep;
            }
        }
        this.forces = [];
    }

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

    fixedUpdate(timeStep) {
        this.applyForces(timeStep);

        this.x += this.vx * timeStep;
        this.y += this.vy * timeStep;


        return this
    }

    magnitude(x1, y1, x2, y2) {
        var x = x2 - x1;
        var y = y2 - y1;
        return Math.sqrt(x * x + y * y);
    }

    // Performs Newton's method to solve for mean anomaly in elliptical and hyperbolic orbits
    Newton(steps, time, Ecc, timeInt, a, mass) {
        var n;
        var E = 0;
        var Mean = 0;
        if (Ecc > 1) {
            Mean = Math.sqrt(mass / -(a * a * a)) * (time - timeInt);
            E = Mean;
            for (n = 0; n < steps; n++) {
                var func = Mean - Ecc * Math.sinh(E) + E;
                var func1 = Ecc * Math.cosh(E) - 1;
                var Ebefore = E;
                E = E + func / func1;
                if (E - Ebefore < .01)
                    break;
            }
        }
        else if (Ecc < 1) {
            Mean = Math.sqrt(mass / (a * a * a)) * (time - timeInt);
            E = Mean;
            for (n = 0; n < steps; n++) {
                var denom = (1 - Ecc * (Math.cos(E)));
                if (denom != 0) {
                    var Ebefore = E;
                    E = E - (E - Ecc * Math.sin(E) - Mean) / denom;
                    if (E - Ebefore < .01)
                        break;
                }
                else {
                    break;
                }
            }
        }
        return E;
    }

    calculateHyperbolicOrbit(a, Ecc, theta, w, mass) {
        var maxDrawSteps = 500;
        var drawStep = .1;
        var maxNewtonSteps = 10;
        var maxDrawDist = 50000;

        var W = (Ecc + Math.cos(theta)) / (1 + Ecc * Math.cos(theta));
        var Eint = Math.log(W + Math.sqrt(W * W - 1));
        var Meanint = Ecc * Math.sinh(Eint) - Eint;
        var isClockwise = ((this.vx * this.y - this.vy * this.x) > 0 ? 1 : -1);
        if (Ecc < 10) {
            var timeInt = Meanint * Math.sqrt(-(a * a * a) / mass);
        } else {
            var timeInt = Math.asinh(Meanint / Ecc);
        }
        var curTime = 0;
        var r, x = this.x, y = -this.y, EccAnom;
        var orbitPoints = [];
        var dist = this.magnitude(this.x, -this.y, x, y);

        var flipped = false;
        var beforeDist;

        while (orbitPoints.length < maxDrawSteps && dist < maxDrawDist) {
            EccAnom = this.Newton(maxNewtonSteps, curTime, Ecc, timeInt, a, mass);
            theta = 2 * Math.atan(Math.sqrt((1 + Ecc) / (Ecc - 1)) * Math.tanh(EccAnom / 2));
            r = a * (Ecc * Math.cosh(EccAnom) - 1);
            x = -r * (Math.cos(theta - w));
            y = -r * (Math.sin(theta - w));
            var orbitPos = { x, y };
            dist = this.magnitude(this.x, -this.y, x, y);

            if (orbitPoints.length === 0 && beforeDist < dist && flipped) {
                timeInt = -timeInt;
                beforeDist = dist;
                continue;
            }

            if (orbitPoints.length === 0 && dist > 500 && !flipped) {
                timeInt = -timeInt;
                flipped = true;
                beforeDist = dist;
                continue;
            }

            if (!isNaN(x) && !isNaN(y)) {
                orbitPoints.push(orbitPos);
            }

            curTime += isClockwise * drawStep;
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
            orbitParams.points = this.calculateHyperbolicOrbit(a, Ecc, theta, w, mass);
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

    calculateShootingOrbit(shotPower, player, mass) {
        var shootX = (player.clientX - player.x);
        var shootY = (player.clientY - player.y);
        var dist = Math.sqrt(Math.pow(shootX, 2) + Math.pow(shootY, 2));

        // Calculate the bullet velocity by adding the player's vel with their shot
        this.vx = player.vx + shotPower * shootX / dist;
        this.vy = player.vy + shotPower * shootY / dist;

        return this.calculateOrbit(mass);
    }

};
module.exports = Mass;
