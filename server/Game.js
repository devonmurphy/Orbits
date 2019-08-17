var Mass = require('./Mass.js');
var PowerUp = require('./PowerUp.js');
var Planet = require('./Planet.js');
var Map = require('./Map.js');
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
        this.bullets = [];
        this.powerUps = [];

        // Game constants
        this.earthRadius = 1500;
        this.mass = 5000000000;
        this.planet = new Planet(0, 0, this.earthRadius, this.mass);

        // Player constants
        this.playerRadius = 350;
        this.thrust = 200;
        this.startingDist = 8000;
        this.startingFuel = (this.type === 'single player' ? Infinity : 2000);
        this.fuelDrainRate = 1;

        // Player shooting constants
        this.fireRate = 500;
        this.bulletRadius = 175;
        this.startingBulletCount = (this.type === 'single player' ? Infinity : 20);
        this.startingShotPower = 500;
        this.shotPowerChangeRate = 30;
        this.shotPowerMin = 0;
        this.shotPowerMax = 2240;

        // Map constants
        this.gridCount = 3;
        this.gridSize = 10000;
        this.mapRadius = 15000;

        // Single Player constats
        this.asteroidRadius = this.playerRadius;
        this.asteroidSpawnRate = (this.type === 'single player' ? 5000 : Infinity);
        this.lastAsteroidSpawnTime = (new Date()).getTime();

        this.powerUpRadius = this.playerRadius;
        this.powerUpSpawnRate = (this.type === 'single player' ? 5000 : Infinity);
        this.lastPowerUpSpawnTime = (new Date()).getTime();

        this.strikes = (this.type === 'single player' ? 0 : null);
        this.maxStrikes = (this.type === 'single player' ? 3 : null);

        this.map = new Map(this.gridSize, this.gridCount, this.mapRadius);

    }

    calculateThrustForce(thrustPower, player) {
        var thrustX = (player.clientX - player.x);
        var thrustY = (player.clientY - player.y);
        var dist = Math.sqrt(Math.pow(thrustX, 2) + Math.pow(thrustY, 2));

        // Calculate the thrust vector
        var thrust = {
            x: thrustPower * thrustX / dist,
            y: thrustPower * thrustY / dist,
        }
        return thrust;
    }

    checkIfPowerUpSpawns() {
        var currentTime = (new Date()).getTime();
        if (currentTime - this.lastPowerUpSpawnTime >= this.powerUpSpawnRate) {


            var startingDist = Math.random() * 10000 + 20000;
            var XYRatio = Math.random();
            var startingDistX = (Math.random() > .5 ? -1 : 1) * startingDist * (XYRatio);
            var startingDistY = (Math.random() > .5 ? -1 : 1) * startingDist * (Math.sqrt(1 - XYRatio * XYRatio));

            var powerUp = new PowerUp(startingDistX, startingDistY, this.powerUpRadius, "fireRate");

            var dist = Math.sqrt(Math.pow(powerUp.x, 2) + Math.pow(powerUp.y, 2));
            var speedSpreadX = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            var speedSpreadY = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            powerUp.vx = -powerUp.x / dist * 500 + speedSpreadX;
            powerUp.vy = -powerUp.y / dist * 500 + speedSpreadY;

            this.powerUps.push(utils.deepCopy(powerUp));
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

            var asteroid = new Mass(
                startingDistX,
                startingDistY,
                this.asteroidRadius);

            var dist = Math.sqrt(Math.pow(asteroid.x, 2) + Math.pow(asteroid.y, 2));
            var speedSpreadX = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            var speedSpreadY = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            asteroid.vx = -asteroid.x / dist * 500 + speedSpreadX;
            asteroid.vy = -asteroid.y / dist * 500 + speedSpreadY;

            asteroid.id = "asteroid";
            asteroid.type = "bullet";
            // asteroid.orbitParams = asteroid.calculateOrbit(this.planet.mass);
            this.bullets.push(utils.deepCopy(asteroid));
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
        var sharedPlayer = new Mass(this.startingDist * playerOffsetX, this.startingDist * playerOffsetY, this.playerRadius);

        // Calculate velocity for circular orbit
        var dist = Math.sqrt(Math.pow(sharedPlayer.x, 2) + Math.pow(sharedPlayer.y, 2));
        var circularOrbitVel = Math.sqrt(this.planet.mass / dist);

        // Here we took the derivitive of the offsets when they were multplied by the velocity
        sharedPlayer.vx = circularOrbitVel * playerOffsetY;
        sharedPlayer.vy = -circularOrbitVel * playerOffsetX;
        sharedPlayer.fuel = this.startingFuel;

        // Initial calculation of orbit parameters
        var orbitParams = sharedPlayer.calculateOrbit(this.planet.mass);
        this.players[socket.id] = {
            player: utils.deepCopy(sharedPlayer),
            name: playerName,
            orbitParams: utils.deepCopy(orbitParams),
            controls: { x: 0, y: 0 },
            shotPower: this.startingShotPower,
            bulletCount: this.startingBulletCount,
            score: 0,
        };
        this.players[socket.id].player.id = socket.id;
        this.players[socket.id].player.type = "player";
    }

    // Receives player controls
    movement(data) {
        var socket = this;
        var players = this.players;
        if (Object.keys(players).length > 0 && players[socket.id]) {
            var player = players[socket.id].player;
            var tangent = { x: -player.vy, y: player.vx };
            var speed = Math.sqrt(Math.pow(player.vx, 2) + Math.pow(player.vy, 2));
            players[socket.id].controls = { x: 0, y: 0 };
            if (data.right) {
                players[socket.id].controls.x -= tangent.x / speed * this.thrust;
                players[socket.id].controls.y -= tangent.y / speed * this.thrust;
            }
            if (data.left) {
                players[socket.id].controls.x += tangent.x / speed * this.thrust;
                players[socket.id].controls.y += tangent.y / speed * this.thrust;
            }
            if (data.forward) {
                players[socket.id].controls.x += player.vx / speed * this.thrust;
                players[socket.id].controls.y += player.vy / speed * this.thrust;
            }
            if (data.backward) {
                players[socket.id].controls.x -= player.vx / speed * this.thrust;
                players[socket.id].controls.y -= player.vy / speed * this.thrust;
            }
        }

    }

    // Adjusts player shot power whenever they scroll
    wheelMove(data) {
        var id = this.id;
        var players = this.players;
        if (players[id]) {
            if (players[id].player) {
                var player = players[id];
                if (data < 0) {
                    player.shotPower += this.shotPowerChangeRate;
                }

                if (data > 0) {
                    player.shotPower -= this.shotPowerChangeRate;
                }
                // Clamp values between shotPowerMin and shotPowerMax
                if (player.shotPower < this.shotPowerMin) {
                    player.shotPower = this.shotPowerMin;
                }
                if (player.shotPower > this.shotPowerMax) {
                    player.shotPower = this.shotPowerMax;
                }
            }
        }
    }

    // Calculates shooting orbit while mouse is down
    mousedown(data) {
        var id = this.id;
        var players = this.players;
        if (players[id]) {
            if (players[id].player) {
                var player = players[id].player;
                if (data.button === 0) {
                    player.leftMouseDown = true;
                }
                if (data.button === 2) {
                    player.rightMouseDown = true;
                }
            }
        }
    }

    // Fires the bullet when the mouse is released
    mouseup(data) {
        var socket = this;
        var players = this.players;
        var bullets = this.bullets;
        var id = socket.id;
        if (players[id]) {
            if (players[id].player) {
                if (data.button === 0) {
                    var player = players[id].player;
                    var shotPower = players[id].shotPower;
                    player.leftMouseDown = false;
                    var currentTime = (new Date()).getTime();
                    if (player.lastMouseUpTime === undefined) {
                        player.lastMouseUpTime = 0;
                    }
                    if (players[id].bulletCount === undefined) {
                        players[id].bulletCount = this.startingBulletCount;
                    }
                    if (currentTime - player.lastMouseUpTime > this.fireRate && players[id].bulletCount !== 0) {
                        players[id].bulletCount -= 1;
                        player.lastMouseUpTime = currentTime;
                        var bullet = new Mass(player.x, player.y, this.bulletRadius);
                        bullet.calculateShootingOrbit(shotPower, player, this.planet.mass);
                        bullet.id = socket.id;
                        bullet.type = "bullet"
                        bullets.push(utils.deepCopy(bullet));
                    }
                } else if (data.button === 2) {
                    var player = players[id].player;
                    player.rightMouseDown = false;
                }
            }
        }
    }

    // Update the player's clientX and clientY position when they move their mouse
    mousemove(data) {
        var id = this.id
        var players = this.players;
        if (players[id]) {
            if (players[id].player) {
                var player = players[id].player;
                if (player.leftMouseDown === true) {
                    player.clientX = data.clientX;
                    player.clientY = -data.clientY;
                }
                if (player.rightMouseDown === true) {
                    player.clientX = data.clientX;
                    player.clientY = -data.clientY;
                }
            }
        }
    }

    connectPlayer(player) {
        var socket = player.socket;
        if (!this.playerSockets.includes(socket)) {
            this.playerSockets.push(socket);
        }
        Object.assign(socket, this);
        socket.join(this.gameId);

        // Player controls
        socket.on('movement', this.movement);
        socket.on('wheel', this.wheelMove);
        socket.on('mousedown', this.mousedown);
        socket.on('mouseup', this.mouseup);
        socket.on('mousemove', this.mousemove);

        // TODO: USE THESE FOR STUFF
        socket.on('mouseout', function (data) {
        });
        socket.on('keyup', function (data) {
        });

        // Spawn the player on the map
        this.spawnPlayer(socket, player.name);
        if (this.autoStart && this.playerCount === this.playerSockets.length) {
            this.start();
        }
    }

    reconnectPlayer(socket, oldSocket, player) {
        Object.assign(socket, this);
        socket.join(this.gameId);

        // Player controls
        socket.on('movement', this.movement);
        socket.on('wheel', this.wheelMove);
        socket.on('mousedown', this.mousedown);
        socket.on('mouseup', this.mouseup);
        socket.on('mousemove', this.mousemove);

        // TODO: USE THESE FOR STUFF
        socket.on('mouseout', function (data) {
        });
        socket.on('keyup', function (data) {
        });

        // Copy old player object and reset the player id
        if (oldSocket.id in this.players) {
            this.players[socket.id] = utils.deepCopy(this.players[oldSocket.id]);
            this.players[socket.id].player.id = socket.id;
        } else {
            this.connectPlayer(player);
            return;
        }

        // Update all of the old bullet ids to the new id
        for (var bullet = 0; bullet < this.bullets.length; bullet++) {
            if (this.bullets[bullet].id === oldSocket.id) {
                this.bullets[bullet].id = socket.id;
            }
        }

        // Delete the old player
        delete this.players[oldSocket.id];
    }


    checkIfGameEnds() {
        if (Object.keys(this.players).length === 1) {
            var lastId = Object.keys(this.players)[0];
            this.io.to(lastId).emit('youwon', 'You Won');
            this.endGame();
        }

        if (Object.keys(this.players).length === 0) {
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

    // Update the game state every 15 ms
    start() {
        this.io.sockets.in(this.gameId).emit('starting game');
        this.gameLoop = setInterval(() => {
            this.checkIfAsteroidSpawns();
            this.checkIfPowerUpSpawns();

            // Loop through the player list and update their position and velocity
            var allObjects = [];
            var players = this.players;
            var shootingOrbits = this.shootingOrbits;
            var bullets = this.bullets;
            var powerUps = this.powerUps;

            // Loop through players and add forces of controls and planet
            for (var id in players) {
                var player = players[id].player;
                var controls = players[id].controls;
                var shotPower = players[id].shotPower;

                if ((player.fuel > 0) && (controls.x || controls.y || player.rightMouseDown)) {

                    // lower their fuel when controls are engaged
                    player.fuel -= this.fuelDrainRate;
                    // dont lower it too much though
                    if (player.fuel < 0) {
                        player.fuel = 0;
                    }

                    var mouseThrustForce = { x: 0, y: 0 };
                    if (player.rightMouseDown === true && player.clientX && player.clientY) {
                        mouseThrustForce = this.calculateThrustForce(this.thrust, player);
                    }
                    var controlForceMag = Math.sqrt(Math.pow(controls.x + mouseThrustForce.x, 2) + Math.pow(controls.y + mouseThrustForce.y, 2));
                    if (controlForceMag !== 0) {
                        var controlForce = {
                            x: (controls.x + mouseThrustForce.x) / controlForceMag * this.thrust,
                            y: (controls.y + mouseThrustForce.y) / controlForceMag * this.thrust
                        };
                        player.addForce(controlForce);
                    }
                }

                this.planet.addForce(player);
                player.update();

                // Player is pressing a movement control - recalculate the player orbit
                if (controls.x || controls.y || player.rightMouseDown) {
                    var orbitParams = player.calculateOrbit(this.planet.mass);
                    players[id].orbitParams = utils.deepCopy(orbitParams);
                }

                // Player mouse is down - calculate the shooting orbit
                if (player.leftMouseDown === true) {
                    var bullet = new Mass(player.x, player.y, this.bulletRadius);
                    var orbitParams = bullet.calculateShootingOrbit(shotPower, player, this.planet.mass);
                    shootingOrbits[id] = utils.deepCopy(orbitParams);
                }

                // If a player is out of the map destroy them
                if (this.map.checkOutOfBounds(player)) {
                    this.killPlayer(this.io, id);
                } else {
                    allObjects.push(player);
                }

            }

            // Calculate the bullet trajectories
            for (var i = 0; i < bullets.length; i++) {
                var bullet = bullets[i];
                // First check if a bullet is out of bounds
                if (this.map.checkOutOfBounds(bullet, 2 * this.mapRadius)) {
                    // Remove it if it is too far away
                    bullets.splice(i, 1);
                    continue;
                }

                // Update the bullet's trajectory
                this.planet.addForce(bullets[i]);
                bullet.update();
                allObjects.push(bullet);
            }

            // Calculate the powerUp trajectories
            for (var i = 0; i < powerUps.length; i++) {
                var powerUp = powerUps[i];
                // First check if a bullet is out of bounds
                if (this.map.checkOutOfBounds(powerUp, 2 * this.mapRadius)) {
                    // Remove it if it is too far away
                    powerUps.splice(i, 1);
                    continue;
                }

                // Update the bullet's trajectory
                this.planet.addForce(powerUp);
                powerUp.update();
                allObjects.push(powerUp);
            }

            // Add the earth as an object 
            allObjects.push(this.planet);

            this.map.objects = allObjects;
            this.map.updateCollisions();
            var collisions = this.map.collisions;

            // Handle collsions here
            for (var i = 0; i < collisions.length; i++) {
                // Delete the bullet if they hit another object
                if (collisions[i].type === 'bullet') {
                    if (bullets.indexOf(collisions[i]) > -1) {
                        bullets.splice(bullets.indexOf(collisions[i]), 1);

                        // if Single player mode increase score or decrease strikes
                        if (this.type === 'single player') {
                            if (players[collisions[i].hitBy.id] && collisions[i].id === 'asteroid') {
                                players[collisions[i].hitBy.id].score += 1;
                            } else {
                                if (collisions[i].hitBy.id === 'planet') {
                                    this.strikes += 1;
                                    if (this.strikes >= this.maxStrikes) {
                                        for (var playerId in this.players) {
                                            this.io.to(playerId).emit('youdied', 'Your Planet Died');
                                        }
                                        this.endGame();
                                    }
                                }
                            }
                        }
                    }
                }

                // Delete the player if they got hit
                if (collisions[i].type === 'player' && collisions[i].hitBy.id !== 'powerUp') {
                    if (collisions[i].hitBy.id) {
                        if (players[collisions[i].hitBy.id]) {
                            players[collisions[i].hitBy.id].score += 1;
                        }
                    }
                    var id = collisions[i].id;

                    this.killPlayer(this.io, id);
                }

                if (collisions[i].type === 'powerUp' && collisions[i].hitBy.type === 'bullet') {
                    if (powerUps.indexOf(collisions[i]) > -1 && collisions[i].hitBy.id !== 'asteroid') {
                        const player = players[collisions[i].hitBy.id];
                        console.log(collisions[i]);
                        collisions[i].applyPowerUp(player);
                        powerUps.splice(powerUps.indexOf(collisions[i]), 1);
                    }
                }

                if (collisions[i].type === 'powerUp' && collisions[i].hitBy.type === 'player') {
                    if (powerUps.indexOf(collisions[i]) > -1) {
                        const player = players[collisions[i].hitBy.id];
                        collisions[i].applyPowerUp(player);
                        powerUps.splice(powerUps.indexOf(collisions[i]), 1);
                    }
                }
            }

            var map = utils.deepCopy(this.map);
            var strikes = this.strikes;
            var maxStrikes = this.maxStrikes;
            var gameState = {
                players,
                bullets,
                powerUps,
                shootingOrbits,
                map,
                strikes,
                maxStrikes,
            };

            // Send the game state to the client to be rendered
            this.io.sockets.in(this.gameId).emit('gameState', gameState);
        }, 15)
    }
}

module.exports = Game;