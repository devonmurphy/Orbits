class Planet {
    constructor(x, y, radius, mass) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = mass;
        this.id = 'planet';
    }

    addForce(mass) {
        var dist = Math.sqrt(Math.pow(mass.x, 2) + Math.pow(mass.y, 2));
        var gravity = {
            x: -this.mass * mass.x / (dist * dist * dist),
            y: -this.mass * mass.y / (dist * dist * dist),
        };

        // Add a force from the planet to the mass
        mass.addForce(gravity);
    }

};

module.exports = Planet;
