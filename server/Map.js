var Grid = require('./Grid.js');

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
module.exports = Map;