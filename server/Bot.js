var Mass = require('./Mass.js');

// AI-controlled enemy ship: flies toward the nearest player and shoots at
// them once in range. Lives inside Game's `this.objects` alongside asteroids
// and powerups, so it rides the same broadcast/collision plumbing they do.
class Bot extends Mass {
    constructor(x, y, gameId, health) {
        super(x, y, 350);

        this.id = gameId;
        this.type = 'bot';
        this.name = 'Bot';
        this.health = health;

        this.thrust = 150;
        this.engageRange = 9000;
        this.thrusting = false;

        // Shooting - mirrors the fields Bullet/Game.spawnBullet expect from
        // a Player, so bots can reuse spawnBullet() unchanged.
        this.fireRate = 900;
        this.bulletRadius = 175;
        this.bulletHealth = 1;
        this.shotPower = 500;
        this.lastFireTime = 0;
        this.clientX = x;
        this.clientY = y;
    }

    // Steers toward the target and aims at it. Returns true if the bot is
    // in range and off cooldown, i.e. it wants to fire a bullet this tick.
    think(target, currentTime) {
        var dx = target.x - this.x;
        var dy = target.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Aim point used both for the client's heading indicator and for
        // Bullet.calculateShootingOrbit()
        this.clientX = target.x;
        this.clientY = target.y;

        this.thrusting = dist > this.engageRange;
        if (this.thrusting) {
            this.addForce({
                x: dx / dist * this.thrust,
                y: dy / dist * this.thrust,
            });
        }

        var inRange = dist < this.engageRange;
        var offCooldown = (currentTime - this.lastFireTime) > this.fireRate;
        return inRange && offCooldown;
    }
}

module.exports = Bot;
