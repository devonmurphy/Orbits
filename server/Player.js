var Mass = require('./Mass.js');

var DEBUG_LAG = 0;

class Player extends Mass {
    constructor(x, y, name) {
        super(x, y, 350);

        // Player constants
        this.thrust = 200;
        this.fuelDrainRate = 1;
        this.fuel = 20000;
        this.controls = { x: 0, y: 0 };
        this.score = 0;
        this.type = "player";

        // Player shooting constants
        this.fireRate = 500;
        this.autoFire = true;
        this.bulletRadius = 175;
        this.bulletCount = 500;
        this.shotPower = 500;
        this.bulletHealth = 1;
        this.shotPowerChangeRate = 30;
        this.shotPowerMax = 2240;
        this.lastFireTime = 0;

        this.name = name;
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

    setupHandlers(socket) {
        this.id = socket.id;
        // Player controls
        socket.on('movement', this.movement.bind(this));
        socket.on('wheel', this.wheelMove.bind(this));
        socket.on('mousedown', this.mousedown.bind(this));
        socket.on('mouseup', this.mouseup.bind(this));
        socket.on('mousemove', this.mousemove.bind(this));

        // TODO: USE THESE FOR STUFF
        socket.on('mouseout', function (data) {
        }.bind(this));
        socket.on('keyup', function (data) {
        }.bind(this));
    }

    // Receives player controls
    movement(data) {
        setTimeout(() => {
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
        }, DEBUG_LAG);
    }

    // Adjusts player shot power whenever they scroll
    wheelMove(data) {
        setTimeout(() => {
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
        }, DEBUG_LAG);
    }

    // Calculates shooting orbit while mouse is down
    mousedown(data) {
        setTimeout(() => {
            this.clientX = data.clientX;
            this.clientY = -data.clientY;
            if (data.button === 0) {
                this.leftMouseDown = true;
                this.leftMouseUp = false;
            } else if (data.button === 1) {
                this.middleMouseDown = true;
            } else if (data.button === 2) {
                this.rightMouseDown = true;
            }

        }, DEBUG_LAG);
    }

    // Fires the bullet when the mouse is released
    mouseup(data) {
        setTimeout(() => {
            if (data.button === 0) {
                this.leftMouseDown = false;
                this.leftMouseUp = true;
            } else if (data.button === 1) {
                this.middleMouseDown = false;
            } else if (data.button === 2) {
                this.rightMouseDown = false;
            }
        }, DEBUG_LAG);
    }

    // Update the player's clientX and clientY position when they move their mouse
    mousemove(data) {
        setTimeout(() => {
            this.clientX = data.clientX;
            this.clientY = -data.clientY;

        }, DEBUG_LAG);
    }
}

module.exports = Player;
