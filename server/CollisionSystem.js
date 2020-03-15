var Collisions = require('./Collisions.js');

// Class used to check the hit boxes
class CollisionSystem {
    constructor() {
        this.map = [];
        this.objects = [];
    }

    // Iterate through all of the grids to see if there are collisions
    updateCollisions() {
        // Reset the collisions to get new ones
        this.collisions = [];
        // Create the collision system
        const system = new Collisions.Collisions();
        // Create a Result object for collecting information about the collisions
        const result = system.createResult();

        // Add all the objects to the collision system as circles
        let colliders = [];
        for (var i = 0; i < this.objects.length; i++) {
            let o = this.objects[i];
            let c = system.createCircle(o.x, o.y, o.radius);
            c.id = o.id;
            c.uid = o.uid;
            c.type = o.type;
            c.health = o.health;
            colliders.push(c);
        }

        // Update the collision system and get potential collisions
        system.update();

        // Loop though each collider
        for (var i = 0; i < colliders.length; i++) {
            let c = colliders[i];
            let o = this.objects[i];
            const potentials = c.potentials();
            // Loop through the potential collisions
            for (const collision of potentials) {
                // Only count collisions that are not between a player's own bullets and themselves
                if (!(c.id === collision.id && c.type !== collision.type)) {
                    if (c.collides(collision, result)) {
                        this.collisions = this.collisions.concat({
                            id: c.id,
                            uid: c.uid,
                            type: c.type,
                            x: c.x,
                            y: c.y,
                            radius: c.radius,
                            health: c.health,
                            hitBy: {
                                id: collision.id,
                                type: collision.type,
                            }
                        });
                    }
                }
            }
        }
    }
}
module.exports = CollisionSystem;