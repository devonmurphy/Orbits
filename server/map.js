// Divide up the map into a grid class
class Grid {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.objects = [];
        this.collisions = []
    }

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

    checkCollision(obj1, obj2) {
        if (obj1.id === obj2.id){
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

    getCollisions(iteration = 0) {
        if (this.objects.length <= 1) {
            return;
        }
        for (var n = iteration; n < this.objects.length - 1; n++) {
            if (this.checkCollision(this.objects[iteration], this.objects[n + 1]) === true) {
                if (this.collisions.indexOf(this.objects[iteration]) === -1) {
                    this.collisions.push(this.objects[iteration]);
                }
                if (this.collisions.indexOf(this.objects[n + 1]) === -1) {
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
    constructor(mapSize, gridSize) {
        this.mapSize = mapSize;
        this.gridSize = gridSize;
        this.map = [];
        this.objects = [];
        this.createMap();
    }

    createMap() {
        // Create Map
        for (var x = -this.mapSize; x < this.mapSize; x++) {
            for (var y = -this.mapSize; y < this.mapSize; y++) {
                var grid = new Grid(x * this.gridSize, y * this.gridSize, this.gridSize);
                this.map.push(grid);
            }
        }
    }

    updateCollisions() {
        this.collisions = [];
        for (var i = 0; i < this.map.length; i++) {
            var grid = this.map[i];
            grid.collisions = [];
            grid.getObjectsInRange(this.objects);
            grid.getCollisions();
            this.collisions = this.collisions.concat(grid.collisions);
        }
    }

}
module.exports = { Map };