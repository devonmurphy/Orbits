var orbit = require('./orbits.js');
var map = require('./map.js');

class Game {
    constructor(io, gameId, playerSockets) {
        // Server side constants
        this.io = io;
        this.gameId = gameId;
        this.playerSockets = playerSockets;

        // Containers used for game state
        this.players = {};
        this.shootingOrbits = {};
        this.bullets = [];

        // Game constants
        this.earthRadius = 1500;
        this.mass = 5000000000;
        this.planet = new orbit.Planet(0, 0, this.earthRadius, this.mass);

        // Player constants
        this.playerRadius = 250;
        this.thrust = 200;
        this.startingDist = 4000;
        this.startingFuel = 2000;
        this.fuelDrainRate = 1;

        // Player shooting constants
        this.fireRate = 500;
        this.bulletRadius = 125;
        this.startingBulletCount = 20;
        this.startingShotPower = 500;
        this.shotPowerChangeRate = 30;
        this.shotPowerMin = 0;
        this.shotPowerMax = 2240;

        // Map constants
        this.mapSize = 1;
        this.gridSize = 10000;
        this.map = new map.Map(this.mapSize, this.gridSize);

        this.connectAllPlayers();
    }

    deepCopy(obj) {
        var copy = Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
        return copy;
    }

    calculateShootingOrbit(shotPower, player, bullet) {
        var shootX = (player.clientX - player.x);
        var shootY = (player.clientY - player.y);
        var dist = Math.sqrt(Math.pow(shootX, 2) + Math.pow(shootY, 2));

        // Calculate the bullet velocity by adding the player's vel with their shot
        bullet.vx = player.vx + shotPower * shootX / dist;
        bullet.vy = player.vy + shotPower * shootY / dist;
        return bullet.calculateOrbit(this.planet.mass);
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

    // Create a new player
    newPlayer(socket) {
        // Spawn player either at (-startingDist,0) or (startingDist,0)
        var sign = (Object.keys(this.players).length % 2 === 0 ? -1 : 1);
        var sharedPlayer = new orbit.Mass(sign * this.startingDist, 0, this.playerRadius);

        // Calculate velocity for circular orbit
        var dist = Math.sqrt(Math.pow(sharedPlayer.x, 2) + Math.pow(sharedPlayer.y, 2));
        var circularOrbitVel = Math.sqrt(this.planet.mass / dist);
        sharedPlayer.vy = -sign * circularOrbitVel;
        sharedPlayer.fuel = this.startingFuel;

        // Initial calculation of orbit parameters
        var orbitParams = sharedPlayer.calculateOrbit(this.planet.mass);
        this.players[socket.id] = {
            player: this.deepCopy(sharedPlayer),
            orbitParams: this.deepCopy(orbitParams),
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
        console.log(players);
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
                        var bullet = new orbit.Mass(player.x, player.y, this.bulletRadius);
                        this.calculateShootingOrbit(shotPower, player, bullet);
                        bullet.id = socket.id;
                        bullet.type = "bullet"
                        bullets.push(this.deepCopy(bullet));
                    }
                } else if (data.button === 2) {
                    var player = players[id].player;
                    player.rightMouseDown = false;
                }
            }
        }
    }

    // Update the player's clientX and clientY position when they move their mouse
    mousemove(players) {
        var id = this.id
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

    connectPlayer(socket) {
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
        this.newPlayer(socket);
    }

    connectAllPlayers() {
        for (var i = 0; i < this.playerSockets.length; i++) {
            this.connectPlayer(this.playerSockets[i]);
        }
    }

    // Update the game state every 15 ms
    runGame() {
        var gameLoop = setInterval(() => {
            // Loop through the player list and update their position and velocity
            var allObjects = [];
            var players = this.players;
            var shootingOrbits = this.shootingOrbits;
            var bullets = this.bullets;

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
                    players[id].orbitParams = this.deepCopy(orbitParams);
                }

                // Player mouse is down - calculate the shooting orbit
                if (player.leftMouseDown === true) {
                    var bullet = new orbit.Mass(player.x, player.y, this.bulletRadius);
                    var orbitParams = this.calculateShootingOrbit(shotPower, player, bullet);
                    shootingOrbits[id] = this.deepCopy(orbitParams);
                }
                allObjects.push(player);
            }

            // Calculate the bullet trajectories
            for (var i = 0; i < bullets.length; i++) {
                var bullet = bullets[i];
                this.planet.addForce(bullets[i]);
                bullet.update();
                allObjects.push(bullet);
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
                    }
                }

                // Delete the player if they got hit
                if (collisions[i].type === 'player') {
                    if (collisions[i].hitBy) {
                        if (players[collisions[i].hitBy]) {
                            players[collisions[i].hitBy].score += 1;
                        }
                    }
                    var id = collisions[i].id;

                    this.io.to(id).emit('youdied', 'You Died');
                    delete players[id];

                    if (Object.keys(players).length === 1) {
                        var lastId = Object.keys(players)[0];
                        this.io.to(lastId).emit('youwon', 'You Won');

                        // Game has ended clean up
                        clearInterval(gameLoop);
                    }
                }
            }

            var gameState = {
                players,
                bullets,
                shootingOrbits,
            };

            // Send the game state to the client to be rendered
            this.io.sockets.in(this.gameId).emit('gameState', gameState);
        }, 15)
    }
}

module.exports = Game;