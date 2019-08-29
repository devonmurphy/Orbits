var Mass = require('./Mass.js');

class Asteroid extends Mass {
    constructor(x, y, radius, gameId, health) {
        super(x, y, radius);
        this.id = gameId;
        this.type = "asteroid"
        this.health = health;
    }
}

module.exports = Asteroid;