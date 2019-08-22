var Mass = require('./Mass.js');

class PowerUp extends Mass {
    constructor(x, y, radius, power) {
        super(x, y, radius);
        this.type = "powerUp";
        this.id = "powerUp";
        this.power = power;
        this.powers = [
            'fireRate',
            'shotPowerMax',
            'thrust',
            'bulletHealth',
            /*
            'shield',
            'turrets',
            'bulletHoming',
            'sidewinder',
            'exlosiveAmmo',
            'laser',
            'railGun',
            'orbitTracker',
            */
        ]
    }

    generateRandomPower() {
         this.power = this.powers[Math.floor(Math.random()*this.powers.length)];
         console.log("Power up created:" + this.power);
    }

    applyPowerUp(player, planet) {
        if (this.power === undefined) {
            this.generateRandomPower();
        }
        switch (this.power) {
            case 'fireRate':
                player.fireRate *= 0.9;
                break;
            case 'thrust':
                player.thrust += 100;
                break;
            case 'shotPowerMax':
                player.shotPowerMax += 100;
                break;
            case 'shield':
                planet.shield += 1;
                break;
            case 'turrets':
                planet.turrets += 1;
                break;
            case 'bulletHealth':
                player.bulletHealth += 1;
                break;
            case 'bulletHoming':
                player.bulletHoming += 1;
                break;
            case 'sidewinder':
                player.sidewinder += 1;
                break;
            case 'explosiveAmmo':
                player.explosiveAmmo += 1;
                break;
            case 'laser':
                player.laser += 1;
                break;
            case 'railGun':
                player.railGun += 1;
                break;
            case 'orbitTracker':
                player.orbitTracker += 1;
                break;
            default:
        }
    }

};
module.exports = PowerUp;
