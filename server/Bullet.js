var Mass = require('./Mass.js');

class Bullet extends Mass {
    constructor(player) {
        super(player.x, player.y, player.bulletRadius);
        this.id = player.id;
        this.type = "bullet"
        this.health = player.bulletHealth
    }
}

module.exports = Bullet;