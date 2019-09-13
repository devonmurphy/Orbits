var Mass = require('./Mass.js');

class Bullet extends Mass {
    constructor(player) {
        super(player.x, player.y, player.bulletRadius);
        this.id = player.id;
        this.type = "bullet"
        this.health = player.bulletHealth
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
}

module.exports = Bullet;