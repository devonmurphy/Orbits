var Mass = require('./Mass.js');

class Asteroid extends Mass {
    constructor(x, y, radius, gameId, health) {
        super(x, y, radius + (health - 1) * 150);
        this.id = gameId;
        this.type = "asteroid";
        this.health = health;
    }

    updateRadius(radius) {
        this.radius = radius + (this.health - 1) * 150;
    }
}

module.exports = Asteroid;