var Player = require('./Player.js');
var Bullet = require('./Bullet.js');
var Planet = require('./Planet.js');
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

        // Single Player constats
        this.asteroidRadius = 350;

        this.powerUpRadius = 350;
    }

    // Update the game state every 15 ms
    start() {
        //this.io.sockets.in(this.gameId).emit('starting game');
        this.gameLoop = setInterval(() => {
            this.updateObjects();
            this.updatePlayers();

            var objects = this.objects;
            var players = this.players;
            var shootingOrbits = this.shootingOrbits;
            var strikes = this.strikes;
            var maxStrikes = this.maxStrikes;
            var gameState = {
                players,
                objects,
                shootingOrbits,
                strikes,
                maxStrikes,
            };

            // Send the game state to the clients to be rendered
            //this.io.sockets.in(this.gameId).emit('gameState', gameState);
        }, 15)
    }

    updateGameState(gameState) {
        for (var player in gameState.players) {
            console.log(this.players[player]);
            this.players[player].x = gameState.players[player].x;
            this.players[player].y = gameState.players[player].y;
            this.players[player].vx = gameState.players[player].vx;
            this.players[player].vy = gameState.players[player].vy;
            this.players[player].fuel = gameState.players[player].fuel;
            this.players[player].lastFireTime = gameState.players[player].lastFireTime;
        }
        //this.objects = gameState.objects;
        //this.shootingOrbits = gameState.shootingOrbits;
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
        //socket.join(this.gameId);

        // Spawn the player on the map
        this.spawnPlayer(socket, player.name);

        // Automatically start the game if autoStart is true and the playerCount is reached
        if (this.autoStart && Object.keys(this.players).length === this.playerCount) {
            this.start();
        }
    }

    endGame() {
        // Game has ended clean up
        clearInterval(this.gameLoop);
        this.gameEnded(this.gameId)
    }

    spawnBullet(player) {
        var bullet = new Bullet(player);
        bullet.calculateShootingOrbit(player.shotPower, player, this.planet.mass);
        this.objects[bullet.uid] = utils.deepCopy(bullet);
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

                players[id].thrusting = true;
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
                var isClockwise = ((p.vx) > 0 ? 1 : -1);
                var angle = isClockwise * Math.acos(p.vy / Math.sqrt(p.vx * p.vx + p.vy * p.vy));
                players[id].rotation = angle;
                players[id].thrusting = false;
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
                var bullet = new Bullet(player);
                var orbitParams = bullet.calculateShootingOrbit(shotPower, player, this.planet.mass);
                shootingOrbits[id] = utils.deepCopy(orbitParams);
                var currentTime = (new Date()).getTime();

                var shootX = (player.clientX - player.x);
                var shootY = (player.clientY - player.y);
                var isClockwise = ((shootX) > 0 ? 1 : -1);
                var angle = isClockwise * Math.acos(shootY / Math.sqrt(shootX * shootX + shootY * shootY));
                players[id].rotation = angle;

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


        }

    }

    // Update all of the objects positions
    updateObjects() {
        // Apply the planet force to all the non player objects
        for (var uid in this.objects) {
            var object = this.objects[uid];
            this.planet.addForce(object);
            object.update();
        }
    }
}

module.exports = Game;