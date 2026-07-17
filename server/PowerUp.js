var Mass = require('./Mass.js');

// Rarity controls both drop odds (weights below) and the color the client
// renders the power-up in. Keep this list in sync with the client's
// powerUpRarity map in Renderer.js.
var RARITY_WEIGHTS = {
    common: 50,
    uncommon: 30,
    rare: 15,
    legendary: 5,
};

var POWERS = [
    { name: 'thrust', rarity: 'common' },
    { name: 'fuel cell', rarity: 'common' },

    { name: 'fire rate', rarity: 'uncommon' },
    { name: 'max shooting power', rarity: 'uncommon' },
    { name: 'bullet health', rarity: 'uncommon' },
    { name: 'bullet radius', rarity: 'uncommon' },
    { name: 'bullet count', rarity: 'uncommon' },
    { name: 'fuel', rarity: 'uncommon' },

    { name: 'shield', rarity: 'rare' },
    { name: 'sidewinder', rarity: 'rare' },
    { name: 'extra life', rarity: 'rare' },

    // Passive - these four trigger automatically (three off your regular
    // shots, reanimate off landing a killing blow on a bot), same pattern.
    { name: 'explosive ammo', rarity: 'legendary' },
    { name: 'homing bullets', rarity: 'legendary' },
    { name: 'chain lightning', rarity: 'legendary' },
    { name: 'reanimate', rarity: 'legendary' },
    // Unlock-once active abilities, triggered with number keys 1-5 and
    // gated by their own cooldown rather than being consumed - see
    // Game.js's ABILITY_CONFIG.
    { name: 'teleport', rarity: 'legendary' },
    { name: 'black hole', rarity: 'legendary' },
    { name: 'freeze time', rarity: 'legendary' },
    { name: 'big bomb', rarity: 'legendary' },
    { name: 'holy bubble', rarity: 'legendary' },
];

class PowerUp extends Mass {
    constructor(x, y, radius, power) {
        super(x, y, radius);
        this.type = "powerUp";
        this.id = "powerUp";
        this.power = power;
    }

    // Rolls a rarity tier (weighted) then picks uniformly among that tier's
    // powers, so e.g. having 6 uncommon powers vs 2 rare ones doesn't skew
    // the odds beyond what RARITY_WEIGHTS says.
    generateRandomPower() {
        var totalWeight = Object.keys(RARITY_WEIGHTS).reduce((sum, rarity) => sum + RARITY_WEIGHTS[rarity], 0);
        var roll = Math.random() * totalWeight;
        var chosenRarity = 'common';
        for (var rarity in RARITY_WEIGHTS) {
            if (roll < RARITY_WEIGHTS[rarity]) {
                chosenRarity = rarity;
                break;
            }
            roll -= RARITY_WEIGHTS[rarity];
        }

        var candidates = POWERS.filter((p) => p.rarity === chosenRarity);
        var chosen = candidates[Math.floor(Math.random() * candidates.length)];
        this.power = chosen.name;
        this.rarity = chosen.rarity;
    }

    applyPowerUp(player, planet) {
        if (this.power === undefined) {
            this.generateRandomPower();
        }

        if (!(this.power in player.powerUps)) {
            player.powerUps[this.power] = 1;
        } else {
            player.powerUps[this.power] += 1;
        }
        switch (this.power) {
            case 'thrust':
                player.thrust += 40;
                break;
            case 'fuel cell':
                player.fuel += 300;
                break;
            case 'fire rate':
                player.fireRate *= 0.9;
                break;
            case 'max shooting power':
                player.shotPowerMax += 100;
                break;
            case 'bullet count':
                player.bulletCount += 10;
                break;
            case 'fuel':
                player.fuel += 1000;
                break;
            case 'bullet radius':
                player.bulletRadius += 25;
                break;
            case 'bullet health':
                player.bulletHealth += 1;
                break;
            case 'shield':
                player.shieldCharges += 1;
                break;
            case 'sidewinder':
                player.sidewinderLevel += 1;
                break;
            case 'extra life':
                player.extraLives += 1;
                break;
            case 'explosive ammo':
                player.explosiveAmmo += 1;
                break;
            case 'homing bullets':
                player.homingBullets += 1;
                break;
            case 'chain lightning':
                player.chainLightning += 1;
                break;
            case 'teleport':
            case 'black hole':
            case 'freeze time':
            case 'big bomb':
            case 'holy bubble':
                // No effect here - these are unlock-once abilities. Owning
                // at least one (tracked via player.powerUps above) is what
                // lets Game.js's tryActivateAbility() respond to the
                // matching number-key press, gated by its own cooldown.
                break;
            case 'reanimate':
                // No effect here either - Game.js's tryReanimateBot() checks
                // player.powerUps['reanimate'] directly when a bot dies.
                break;
            default:
        }
    }

};
module.exports = PowerUp;
