var Mass = require('./Mass.js');

class Player extends Mass {
    constructor(x, y, name) {
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
        this.bulletCount = Infinity;
        this.shotPower = 500;
        this.bulletHealth = 1;
        this.shotPowerChangeRate = 30;
        this.shotPowerMax = 2240;

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
                this.leftMouseUp = true;
                this.bulletCount -= 1;
                this.lastMouseUpTime = currentTime;
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

module.exports = Player;