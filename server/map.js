// Divide up the map into a grid class
class Grid {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.objects = [];
        this.collisions = []
    }

    // Gets the objects within range of the grid
    getObjectsInRange(objects) {
        this.objects = [];
        for (var i = 0; i < objects.length; i++) {
            var object = objects[i];
            if (this.x < object.x + object.radius &&
                this.x + this.size > object.x &&
                this.y < object.y + object.radius &&
                this.y + this.size > object.y) {
                // collision detected!
                this.objects.push(object);
            }
        }
    }

    // Checks if there is a collision between two objects
    checkCollision(obj1, obj2) {
        // Do not count collisions between a player's own bullets and themselves
        if (obj1.id === obj2.id && obj1.type !== obj2.type) {
            return false;
        }
        var dx = obj1.x - obj2.x;
        var dy = obj1.y - obj2.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < obj1.radius + obj2.radius) {
            return true;
        }
        return false;
    }

    // Recursively finds all of the collisions in the grid
    getCollisions(iteration = 0) {
        if (this.objects.length <= 1) {
            return;
        }

        // Iterates through each unique pair of objects and tests if they are colliding
        for (var n = iteration; n < this.objects.length - 1; n++) {
            // If they are colliding add both to the collisions array
            if (this.checkCollision(this.objects[iteration], this.objects[n + 1]) === true) {
                // Only add them if they are not in already
                if (this.collisions.indexOf(this.objects[iteration]) === -1) {
                    if (this.objects[n + 1].id) {
                        this.objects[iteration].hitBy = this.objects[n + 1].id;
                    }
                    this.collisions.push(this.objects[iteration]);
                }
                if (this.collisions.indexOf(this.objects[n + 1]) === -1) {
                    if (this.objects[iteration].id) {
                        this.objects[n + 1].hitBy = this.objects[iteration].id;
                    }
                    this.collisions.push(this.objects[n + 1]);
                }
            }
        }
        iteration += 1
        if (iteration === this.objects.length - 1) {
            return;
        } else {
            this.getCollisions(iteration);
        }
    }
}

// Class used to check the hit boxes
class Map {
    constructor(gridSize, gridCount, mapRadius) {
        this.gridSize = gridSize;
        this.gridCount = gridCount;
        this.mapRadius = mapRadius;
        this.map = [];
        this.objects = [];
        this.createMap();
    }

    createMap() {
        var overlap = 0.95;
        // Create Map grid square that has sides of gridCount
        for (var x = -this.gridCount; x <= this.gridCount; x++) {
            for (var y = -this.gridCount; y <= this.gridCount; y++) {
                var grid = new Grid(overlap * x * this.gridSize - this.gridSize / 2, overlap * y * this.gridSize - this.gridSize / 2, this.gridSize);
                this.map.push(grid);
            }
        }
    }

    // Iterate through all of the grids to see if there are collisions
    updateCollisions() {
        // Reset the collisions to get new ones
        this.collisions = [];
        for (var i = 0; i < this.map.length; i++) {
            var grid = this.map[i];
            grid.collisions = [];
            grid.getObjectsInRange(this.objects);
            grid.getCollisions();
            this.collisions = this.collisions.concat(grid.collisions);
        }
    }

    // Check if a mass is out of bounds
    checkOutOfBounds(mass, radius = this.mapRadius) {
        var dist = Math.sqrt(Math.pow(mass.x, 2) + Math.pow(mass.y, 2))
        if (dist + mass.radius >= radius) {
            return true;
        } else {
            return false;
        }
    }
}
module.exports = { Map };