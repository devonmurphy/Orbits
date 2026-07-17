var Mass = require('./Mass.js');

class Bullet extends Mass {
    constructor(player) {
        super(player.x, player.y, player.bulletRadius);
        this.id = player.id;
        this.type = "bullet"
        this.health = player.bulletHealth
        // Bullets on a bound (elliptical) orbit never naturally leave the
        // map bounds, so without a lifetime cap they'd accumulate forever -
        // a real source of ongoing lag over a long session.
        this.spawnedAt = Date.now();
        // Power-up flags, read off the shooter at spawn time (bots don't
        // have these fields, so their bullets are never explosive/homing)
        this.explosive = !!(player.explosiveAmmo && player.explosiveAmmo > 0);
        this.homing = !!(player.homingBullets && player.homingBullets > 0);
        this.chainLightning = !!(player.chainLightning && player.chainLightning > 0);
    }

    calculateShootingOrbit(shotPower, player, mass, angleOffset) {
        var shootX = (player.clientX - player.x);
        var shootY = (player.clientY - player.y);

        // Sidewinder fires extra bullets at an angle off the main aim line
        if (angleOffset) {
            var cos = Math.cos(angleOffset);
            var sin = Math.sin(angleOffset);
            var rotatedX = shootX * cos - shootY * sin;
            var rotatedY = shootX * sin + shootY * cos;
            shootX = rotatedX;
            shootY = rotatedY;
        }

        var dist = Math.sqrt(Math.pow(shootX, 2) + Math.pow(shootY, 2));

        // Calculate the bullet velocity by adding the player's vel with their shot
        this.vx = player.vx + shotPower * shootX / dist;
        this.vy = player.vy + shotPower * shootY / dist;

        return this.calculateOrbit(mass);
    }
}

module.exports = Bullet;