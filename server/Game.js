var Mass = require('./Mass.js');
var Player = require('./Player.js');
var Bullet = require('./Bullet.js');
var Asteroid = require('./Asteroid.js');
var PowerUp = require('./PowerUp.js');
var Planet = require('./Planet.js');
var CollisionSystem = require('./CollisionSystem.js');
var utils = require('./utils.js');

class Game {
    constructor(opts) {
        // Server side constants
        this.io = opts.io;
        this.gameId = opts.gameId;
        this.playerCount = opts.playerCount;
        this.gameEnded = opts.gameEnded;
        this.type = opts.type;
        this.autoStart = opts.autoStart;

        // Containers used for game state
        this.players = {};
        this.playerSockets = [];
        this.shootingOrbits = {};
        this.objects = {};

        // Game constants
        this.planetRadius = 1500;
        this.mass = 5000000000;
        this.planet = new Planet(0, 0, this.planetRadius, this.mass);

        // Starting distance to spawn players
        this.startingDist = 8000;

        // Map constants
        this.gridCount = 3;
        this.gridSize = 10000;
        this.mapRadius = 15000;

        // Single Player constats
        this.asteroidRadius = 350;
        this.asteroidSpawnRate = (this.type === 'single player' ? 5000 : Infinity);
        this.lastAsteroidSpawnTime = (new Date()).getTime();

        this.powerUpRadius = 350;
        this.powerUpSpawnRate = (this.type === 'single player' ? 5000 : Infinity);
        this.lastPowerUpSpawnTime = (new Date()).getTime();

        this.strikes = (this.type === 'single player' ? 0 : null);
        this.maxStrikes = (this.type === 'single player' ? 3 : null);

        this.map = new CollisionSystem(this.gridSize, this.gridCount, this.mapRadius);

    }

    checkIfPowerUpSpawns() {
        var currentTime = (new Date()).getTime();
        if (currentTime - this.lastPowerUpSpawnTime >= this.powerUpSpawnRate) {


            var startingDist = Math.random() * 10000 + 20000;
            var XYRatio = Math.random();
            var startingDistX = (Math.random() > .5 ? -1 : 1) * startingDist * (XYRatio);
            var startingDistY = (Math.random() > .5 ? -1 : 1) * startingDist * (Math.sqrt(1 - XYRatio * XYRatio));

            var powerUp = new PowerUp(startingDistX, startingDistY, this.powerUpRadius);

            var dist = Math.sqrt(Math.pow(powerUp.x, 2) + Math.pow(powerUp.y, 2));
            var speedSpreadX = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            var speedSpreadY = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            powerUp.vx = -powerUp.x / dist * 500 + speedSpreadX;
            powerUp.vy = -powerUp.y / dist * 500 + speedSpreadY;

            this.objects[powerUp.uid] = utils.deepCopy(powerUp);
            this.lastPowerUpSpawnTime = (new Date()).getTime();
        }

    }

    checkIfAsteroidSpawns() {
        var currentTime = (new Date()).getTime();
        if (currentTime - this.lastAsteroidSpawnTime >= this.asteroidSpawnRate) {


            var startingDist = Math.random() * 10000 + 20000;
            var XYRatio = Math.random();
            var startingDistX = (Math.random() > .5 ? -1 : 1) * startingDist * (XYRatio);
            var startingDistY = (Math.random() > .5 ? -1 : 1) * startingDist * (Math.sqrt(1 - XYRatio * XYRatio));

            var asteroid = new Asteroid(startingDistX, startingDistY, this.asteroidRadius, this.gameId, 1);

            var dist = Math.sqrt(Math.pow(asteroid.x, 2) + Math.pow(asteroid.y, 2));
            var speedSpreadX = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            var speedSpreadY = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            asteroid.vx = -asteroid.x / dist * 500 + speedSpreadX;
            asteroid.vy = -asteroid.y / dist * 500 + speedSpreadY;

            this.objects[asteroid.uid] = utils.deepCopy(asteroid);
            this.lastAsteroidSpawnTime = (new Date()).getTime();
        }
    }

    // Create a new player
    spawnPlayer(socket, playerName) {
        // Spawn player in a circlular orbit based on which player they are in game
        var playerCount = this.playerCount;
        var playerNumber = Object.keys(this.players).length;
        var playerOffsetX = Math.cos(2 * Math.PI * playerNumber / playerCount);
        var playerOffsetY = Math.sin(2 * Math.PI * playerNumber / playerCount);

        this.players[socket.id] = new Player(this.startingDist * playerOffsetX, this.startingDist * playerOffsetY, playerName);
        this.players[socket.id].setupHandlers(socket);

        // Calculate velocity for circular orbit
        var dist = Math.sqrt(Math.pow(this.players[socket.id].x, 2) + Math.pow(this.players[socket.id].y, 2));
        var circularOrbitVel = Math.sqrt(this.planet.mass / dist);

        // Here we took the derivitive of the offsets when they were multplied by the velocity
        this.players[socket.id].vx = circularOrbitVel * playerOffsetY;
        this.players[socket.id].vy = -circularOrbitVel * playerOffsetX;

        // Initial calculation of orbit parameters
        this.players[socket.id].orbitParams = this.players[socket.id].calculateOrbit(this.planet.mass);
    }

    connectPlayer(player, socket) {
        socket.join(this.gameId);

        // Spawn the player on the map
        this.spawnPlayer(socket, player.name);

        // Automatically start the game if autoStart is true and the playerCount is reached
        if (this.autoStart && Object.keys(this.players).length === this.playerCount) {
            this.start();
        }
    }

    reconnectPlayer(socket, oldSocket, player) {
        socket.join(this.gameId);

        // Copy old player object and reset the player id
        if (oldSocket.id in this.players) {
            this.players[socket.id] = utils.deepCopy(this.players[oldSocket.id]);
            this.players[socket.id].id = socket.id;
            this.players[socket.id].setupHandlers(socket);
        } else {
            this.connectPlayer(player, socket);
            return;
        }

        // Update all of the old bullet ids to the new id
        for (var uid in this.objects) {
            if (this.objects[uid].id === oldSocket.id) {
                this.objects[uid].id = socket.id;
            }
        }

        // Delete the old player
        delete this.players[oldSocket.id];
    }

    checkIfGameEnds() {
        if (Object.keys(this.players).length === 1 && this.type !== 'single player') {
            var lastId = Object.keys(this.players)[0];
            this.io.to(lastId).emit('youwon', 'You Won');
            this.endGame();
        }

        if (Object.keys(this.players).length === 0) {
            this.endGame();
        }

        // End the game if the strikes exceeded the max strikes
        if (this.strikes >= this.maxStrikes && this.type === 'single player') {
            this.io.sockets.in(this.gameId).emit('youdied', 'Your Planet Died');
            this.endGame();
        }
    }

    endGame() {
        // Game has ended clean up
        clearInterval(this.gameLoop);
        this.gameEnded(this.gameId)
    }

    killPlayer(io, id) {
        io.to(id).emit('youdied', 'You Died');
        delete this.players[id]

        this.checkIfGameEnds();
    }

    spawnBullet(player) {
        var bullet = new Bullet(player);
        bullet.calculateShootingOrbit(player.shotPower, player, this.planet.mass);
        this.objects[bullet.uid] = utils.deepCopy(bullet);
    }


    handleCollisions() {
        // Create a list of all the objects
        var allObjects = Object.values(this.players).concat(Object.values(this.objects).concat(this.planet));
        this.map.objects = allObjects;
        this.map.updateCollisions();

        var players = this.players;
        var collisions = this.map.collisions;
        // Handle collsions here
        for (var i = 0; i < collisions.length; i++) {
            // Delete the bullet if they hit another object
            if (collisions[i].type === 'bullet' && collisions[i].uid in this.objects) {
                // Delete the bullet if ran out of health
                if (this.objects[collisions[i].uid].health <= 1) {
                    delete this.objects[collisions[i].uid];
                } else {
                    this.objects[collisions[i].uid].health -= 1;
                }

                // if Single player mode increase strikes
                if (this.type === 'single player') {
                    if (collisions[i].hitBy.id === 'planet') {
                        this.strikes += 1;
                        delete this.objects[collisions[i].uid];

                        // check if the game ended because of strikes
                        this.checkIfGameEnds()
                    }
                }
            }

            // Handle collisions of asteroids
            if (collisions[i].type === 'asteroid' && collisions[i].uid in this.objects) {

                // Delete the asteroid if it ran out of health
                if (this.objects[collisions[i].uid].health <= 1) {
                    if (collisions[i].hitBy.id in players) {
                        players[collisions[i].hitBy.id].score += 1;
                    }
                    delete this.objects[collisions[i].uid];
                } else {
                    this.objects[collisions[i].uid].health -= 1;
                }

                // Collision between asteroids and the planet
                if (collisions[i].hitBy.id === 'planet') {
                    this.strikes += 1;
                    if (collisions[i].uid in this.objects) {
                        delete this.objects[collisions[i].uid];
                    }

                    // check if the game ended because of strikes
                    this.checkIfGameEnds()
                }
            }

            // Delete the player if they got hit by something other than a power up
            if (collisions[i].type === 'player' && collisions[i].hitBy.id !== 'powerUp') {
                if (collisions[i].hitBy.id && collisions[i].hitBy.id in players) {
                    if (collisions[i].hitBy.id in players) {
                        players[collisions[i].hitBy.id].score += 1;
                    }
                }
                var id = collisions[i].id;

                this.killPlayer(this.io, id);
            }

            // Collision between power up and player/bullet
            if (collisions[i].type === 'powerUp' && (collisions[i].hitBy.type === 'player' || collisions[i].hitBy.type === 'bullet')) {
                if (collisions[i].uid in this.objects && collisions[i].hitBy.id in players) {
                    const player = players[collisions[i].hitBy.id];
                    this.objects[collisions[i].uid].applyPowerUp(player, this.planet);
                    delete this.objects[collisions[i].uid];
                }
            }

            // Collision between power up and asteroid or planet
            if (collisions[i].type === 'powerUp' && (collisions[i].hitBy.type === 'asteroid' || collisions[i].hitBy.type === 'planet')) {
                if (collisions[i].uid in this.objects) {
                    delete this.objects[collisions[i].uid];
                }
            }
        }
    }

    // Updates the players positions and respond to controls
    updatePlayers() {
        // Loop through the player list and update their position and velocity
        var players = this.players;
        var shootingOrbits = this.shootingOrbits;

        // Loop through players and add forces of controls and planet
        for (var id in players) {
            var player = players[id];
            var controls = players[id].controls;
            var shotPower = players[id].shotPower;

            // If the player has fuel and they are pressing a thrust control down
            if ((player.fuel > 0) && (controls.x || controls.y || player.rightMouseDown)) {

                // lower their fuel when controls are engaged
                player.fuel -= player.fuelDrainRate;
                // dont lower it too much though
                if (player.fuel < 0) {
                    player.fuel = 0;
                }

                // If the right mouse btn is down calculate thrust force
                var mouseThrustForce = { x: 0, y: 0 };
                if (player.rightMouseDown === true && player.clientX && player.clientY) {
                    mouseThrustForce = player.calculateThrustForce(player.thrust, player);
                }

                // Get the magnitude of the mouse controls + key controls
                var controlForceMag = Math.sqrt(Math.pow(controls.x + mouseThrustForce.x, 2) + Math.pow(controls.y + mouseThrustForce.y, 2));


                // normalize controlForce to have magnitude of player.thrust
                if (controlForceMag !== 0) {
                    var controlForce = {
                        x: (controls.x + mouseThrustForce.x) / controlForceMag * player.thrust,
                        y: (controls.y + mouseThrustForce.y) / controlForceMag * player.thrust
                    };

                    var isClockwise = ((controlForce.x) > 0 ? 1 : -1);
                    var angle = isClockwise * Math.acos(controlForce.y / Math.sqrt(controlForce.x * controlForce.x + controlForce.y * controlForce.y));
                    players[id].rotation = angle;

                    // add the control force to the player
                    player.addForce(controlForce);
                }
            } else {
                var p = players[id];
                //var isClockwise = ((p.vx * p.y - p.vy * p.x) > 0 ? 1 : -1);
                var isClockwise = ((p.vx) > 0 ? 1 : -1);
                var angle = isClockwise * Math.acos(p.vy / Math.sqrt(p.vx * p.vx + p.vy * p.vy));
                players[id].rotation = angle;
            }

            // add the planet's force to the player and update their position
            this.planet.addForce(player);
            player.update();

            // Player is pressing a movement control - recalculate the player orbit
            if (controls.x || controls.y || player.rightMouseDown) {
                var orbitParams = player.calculateOrbit(this.planet.mass);
                players[id].orbitParams = utils.deepCopy(orbitParams);
            }

            // Player mouse is down - calculate the shooting orbit
            if (player.leftMouseDown === true) {
                var bullet = new Mass(player.x, player.y, player.bulletRadius);
                var orbitParams = bullet.calculateShootingOrbit(shotPower, player, this.planet.mass);
                shootingOrbits[id] = utils.deepCopy(orbitParams);
                var currentTime = (new Date()).getTime();
                if (player.autoFire && (currentTime - player.lastFireTime) > player.fireRate && player.bulletCount !== 0) {
                    this.spawnBullet(player);
                    player.bulletCount -= 1;
                    player.lastFireTime = currentTime;
                }
            }

            // Player mouse is down enable/disable autofire
            if (player.middleMouseDown === true) {
                player.autoFire = !player.autoFire;
                player.middleMouseDown = false;
            }

            // Player left mouse btn was released
            if (player.leftMouseUp === true) {
                player.leftMouseUp = false;
                var currentTime = (new Date()).getTime();
                if ((currentTime - player.lastFireTime) > player.fireRate && player.bulletCount !== 0) {
                    this.spawnBullet(player);
                    player.bulletCount -= 1;
                    player.lastFireTime = currentTime;
                }
            }

            // If a player is out of the map destroy them
            if (this.map.checkOutOfBounds(player)) {
                this.killPlayer(this.io, id);
            }

        }

    }

    // Update all of the objects positions
    updateObjects() {
        // Apply the planet force to all the non player objects
        for (var uid in this.objects) {
            var object = this.objects[uid];
            if (this.map.checkOutOfBounds(object, 2 * this.mapRadius)) {
                // Remove it if it is too far away
                delete this.objects[object.uid];
                continue;
            }
            this.planet.addForce(object);
            object.update();
        }
    }

    // Update the game state every 15 ms
    start() {
        this.io.sockets.in(this.gameId).emit('starting game');
        this.gameLoop = setInterval(() => {
            this.checkIfAsteroidSpawns();
            this.checkIfPowerUpSpawns();
            this.updateObjects();
            this.updatePlayers();
            this.handleCollisions();

            var objects = this.objects;
            var players = this.players;
            var shootingOrbits = this.shootingOrbits;
            //var map = this.map; // dont want to sent the full map unless we are debugging
            var map = { mapRadius: this.map.mapRadius };
            var strikes = this.strikes;
            var maxStrikes = this.maxStrikes;
            var gameState = {
                players,
                objects,
                shootingOrbits,
                map,
                strikes,
                maxStrikes,
            };

            // Send the game state to the clients to be rendered
            this.io.sockets.in(this.gameId).emit('gameState', gameState);
        }, 15)
    }
}

module.exports = Game;