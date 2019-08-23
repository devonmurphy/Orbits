var Mass = require('./Mass.js');

class Player extends Mass {
    constructor(x, y, radius, opts) {
        super(x, y, radius);

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
        this.bulletCount = 20;
        this.shotPower = 500;
        this.bulletHealth = 1;
        this.shotPowerChangeRate = 30;
        this.shotPowerMax = 2240;

        this.name = opts.name;
        this.id = opts.id;
    }

}