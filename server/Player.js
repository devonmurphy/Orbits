var Mass = require('./Mass.js');

class Player extends Mass {
    constructor(x, y, opts) {
        super(x, y, 350);

        // Player constants
        this.thrust = 200;
        this.fuelDrainRate = 1;
        this.fuel = 2000;
        this.controls = { x: 0, y: 0 };
        this.score = 0;
        this.type = "player";

        // Player shooting constants
        this.fireRate = 500;
        this.bulletRadius = 175;
        this.bulletCount = 20;
        this.shotPower = 500;
        this.bulletHealth = 1;
        this.shotPowerChangeRate = 30;
        this.shotPowerMax = 2240;

        this.name = opts.name;
        this.id = opts.id;
    }

    setupHandlers(socket) {
        this.socket = socket;

        // Player controls
        this.socket.on('movement', this.movement);
        this.socket.on('wheel', this.wheelMove);
        this.socket.on('mousedown', this.mousedown);
        this.socket.on('mouseup', this.mouseup);
        this.socket.on('mousemove', this.mousemove);

        // TODO: USE THESE FOR STUFF
        this.socket.on('mouseout', function (data) {
        });
        this.socket.on('keyup', function (data) {
        });
    }

    calculateThrustForce(thrustPower) {
        var thrustX = (this.clientX - this.x);
        var thrustY = (this.clientY - this.y);
        var dist = Math.sqrt(Math.pow(thrustX, 2) + Math.pow(thrustY, 2));

        // Calculate the thrust vector
        var thrust = {
            x: thrustPower * thrustX / dist,
            y: thrustPower * thrustY / dist,
        }
        return thrust;
    }

    // Receives player controls
    movement(data) {
        var tangent = { x: -this.vy, y: this.vx };
        var speed = Math.sqrt(Math.pow(this.vx, 2) + Math.pow(this.vy, 2));
        this.controls = { x: 0, y: 0 };
        if (data.right) {
            this.controls.x -= tangent.x / speed * this.thrust;
            this.controls.y -= tangent.y / speed * this.thrust;
        }
        if (data.left) {
            this.controls.x += tangent.x / speed * this.thrust;
            this.controls.y += tangent.y / speed * this.thrust;
        }
        if (data.forward) {
            this.controls.x += this.vx / speed * this.thrust;
            this.controls.y += this.vy / speed * this.thrust;
        }
        if (data.backward) {
            this.controls.x -= this.vx / speed * this.thrust;
            this.controls.y -= this.vy / speed * this.thrust;
        }
    }

    // Adjusts player shot power whenever they scroll
    wheelMove(data) {
        // Increase shot power on scroll up
        if (data < 0) {
            this.shotPower += this.shotPowerChangeRate;
        }

        // Increase shot power on scroll down
        if (data > 0) {
            this.shotPower -= this.shotPowerChangeRate;
        }

        // Clamp values between 0 and shotPowerMax
        if (this.shotPower < 0) {
            this.shotPower = 0;
        }
        if (this.shotPower > this.shotPowerMax) {
            this.shotPower = this.shotPowerMax;
        }
    }

    // Calculates shooting orbit while mouse is down
    mousedown(data) {
        if (data.button === 0) {
            this.leftMouseDown = true;
        }
        if (data.button === 2) {
            this.rightMouseDown = true;
        }
    }

    // Fires the bullet when the mouse is released
    mouseup(data) {
        if (data.button === 0) {
            var shotPower = this.shotPower;
            this.leftMouseDown = false;
            var currentTime = (new Date()).getTime();
            if (this.lastMouseUpTime === undefined) {
                this.lastMouseUpTime = 0;
            }
            if (this.bulletCount === undefined) {
                this.bulletCount = this.startingBulletCount;
            }
            if (currentTime - this.lastMouseUpTime > this.fireRate && this.bulletCount !== 0) {
                this.bulletCount -= 1;
                this.lastMouseUpTime = currentTime;
                var bullet = new Mass(this.x, this.y, this.bulletRadius);

                console.log('bullet fired - pew pew');
                /*
                bullet.calculateShootingOrbit(shotPower, this, this.planet.mass);
                bullet.id = socket.id;
                bullet.type = "bullet"
                bullet.health = players[id].bulletHealth;
                this.objects[bullet.uid] = utils.deepCopy(bullet);
                */
            }
        } else if (data.button === 2) {
            this.rightMouseDown = false;
        }
    }

    // Update the player's clientX and clientY position when they move their mouse
    mousemove(data) {
        if (this.leftMouseDown === true) {
            this.clientX = data.clientX;
            this.clientY = -data.clientY;
        }
        if (this.rightMouseDown === true) {
            this.clientX = data.clientX;
            this.clientY = -data.clientY;
        }
    }
}