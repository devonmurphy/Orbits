var Player = require('./Player.js');
var Bullet = require('./Bullet.js');
var Planet = require('./Planet.js');
var utils = require('./utils.js');
var Renderer = require('../Renderer.js');

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
        this.started = false;
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
        this.started = true;
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
            Renderer.render(gameState);

            // Send the game state to the clients to be rendered
            //this.io.sockets.in(this.gameId).emit('gameState', gameState);
        }, 15)
    }

    updateGameState(gameState) {
        for (var player in gameState.players) {
            var newPlayer = gameState.players[player];

            var socket = { id: player };
            if (!(player in this.players)) {
                this.spawnPlayer(socket, player.name);
            }
            var currentPlayer = this.players[player];

            currentPlayer.x = newPlayer.x;
            currentPlayer.y = newPlayer.y;
            currentPlayer.vx = newPlayer.vx;
            currentPlayer.vy = newPlayer.vy;
            currentPlayer.fuel = newPlayer.fuel;
            currentPlayer.lastFireTime = newPlayer.lastFireTime;
            currentPlayer.name = newPlayer.name;
            currentPlayer.orbitParams = newPlayer.orbitParams;
            currentPlayer.thrusting = newPlayer.thrusting;
            currentPlayer.rotation = newPlayer.rotation;
            currentPlayer.controls = newPlayer.controls;
        }
        //this.objects = gameState.objects;
        this.shootingOrbits = utils.deepCopy(gameState.shootingOrbits);
        //this.shootingOrbits = gameState.shootingOrbits[socket.id];
    }

    // Create a new player
    spawnPlayer(socket, playerName) {
        // Spawn player in a circlular orbit based on which player they are in game
        var playerCount = this.playerCount;
        var playerNumber = Object.keys(this.players).length;
        var playerOffsetX = Math.cos(2 * Math.PI * playerNumber / playerCount);
        var playerOffsetY = Math.sin(2 * Math.PI * playerNumber / playerCount);

        this.players[socket.id] = new Player(this.startingDist * playerOffsetX, this.startingDist * playerOffsetY, playerName);
        //this.players[socket.id].setupHandlers(socket);

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
            // add the planet's force to the player and update their position
            this.planet.addForce(player);
            player.update();
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