var Mass = require('./Mass.js');

class PowerUp extends Mass {
    constructor(x, y, radius, power) {
        super(x, y, radius);
        this.type = "powerUp";
        this.id = "powerUp";
        this.power = power;
    }

    applyPowerUp(player, planet) {
        switch (this.power) {
            case 'fireRate':
                player.fireRate *= 0.9;
                break;
            case 'thrust':
                player.thrust += 100;
                break;
            case 'shield':
                planet.shield += 1;
                break;
            case 'turrets':
                planet.turrets += 1;
                break;
            case 'bulletPen':
                player.bulletPen += 1;
                break;
            case 'bulletHoming':
                player.bulletHoming += 1;
                break;
            case 'sidewinder':
                player.sidewinder += 1;
                break;
            case 'explode':
                player.explode += 1;
                break;
            case 'laser':
                player.explode += 1;
                break;
            case 'railgun':
                player.explode += 1;
                break;
            case 'orbitTracker':
                player.orbitTracker += 1;
                break;
            default:
        }
    }

};
module.exports = PowerUp;
