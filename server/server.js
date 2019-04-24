// Base code from https://hackernoon.com/how-to-build-a-multiplayer-browser-game-4a793818c29b
// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var reload = require('reload');
var app = express();
var server = http.Server(app);
var io = socketIO(server);
var orbit = require('./orbits.js');
var map = require('./map.js');

// Setup server to serve the client folder
app.set('port', 5000);
app.use('/client', express.static(path.join(__dirname, '../client')));

// Routing to index.html
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, '../client/html/index.html'));
});

// Starts the server
server.listen(5000, function () {
    console.log('Starting server on port 5000');
});

// Reload code here
reload(app);

// Containers used for game state
var players = {};
var shootingOrbits = {};
var bullets = [];

// Game constants
var earthRadius = 1500;
var mass = 5000000000;
var planet = new orbit.Planet(0, 0, earthRadius, mass);

// Player constants
var playerRadius = 250;
var thrust = 200;
var startingDist = 4000;
var startingFuel = 1000;
var fuelDrainRate = 1;

// Player shooting constants
var fireRate = 500;
var bulletRadius = 125;
var startingBulletCount = 20;
var startingShotPower = 500;
var shotPowerChangeRate = 30;
var shotPowerMin = 0;
var shotPowerMax = 2240;

// Map constants
var mapSize = 5;
var gridSize = 6700;
var map = new map.Map(mapSize, gridSize);

function deepCopy(obj) {
    var copy = Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
    return copy;
}

var calculateShootingOrbit = function (shotPower, player, bullet) {
    var shootX = (player.clientX - player.x);
    var shootY = (player.clientY - player.y);
    var dist = Math.sqrt(Math.pow(shootX, 2) + Math.pow(shootY, 2));

    // Calculate the bullet velocity by adding the player's vel with their shot
    bullet.vx = player.vx + shotPower * shootX / dist;
    bullet.vy = player.vy + shotPower * shootY / dist;
    return bullet.calculateOrbit(planet.mass);
}

var calculateThrustForce = function (thrustPower, player) {
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

// Setup handlers to catch players joining and control input
io.on('connection', function (socket) {
    socket.on('new player', function () {
        // Spawn player either at (-startingDist,0) or (startingDist,0)
        var sign = (Object.keys(players).length % 2 === 0 ? -1 : 1);
        var sharedPlayer = new orbit.Mass(sign * startingDist, 0, playerRadius);

        // Calculate velocity for circular orbit
        var dist = Math.sqrt(Math.pow(sharedPlayer.x, 2) + Math.pow(sharedPlayer.y, 2));
        var circularOrbitVel = Math.sqrt(planet.mass / dist);
        sharedPlayer.vy = -sign * circularOrbitVel;
        sharedPlayer.fuel = startingFuel;

        // Initial calculation of orbit parameters
        var orbitParams = sharedPlayer.calculateOrbit(planet.mass);
        players[socket.id] = {
            player: deepCopy(sharedPlayer),
            orbitParams: deepCopy(orbitParams),
            controls: { x: 0, y: 0 },
            shotPower: startingShotPower,
            bulletCount: startingBulletCount,
        };
        players[socket.id].player.id = socket.id;
        players[socket.id].player.type = "player";
    });

    // Receives player controls
    socket.on('movement', function (data) {
        if (Object.keys(players).length > 0 && players[socket.id]) {
            var player = players[socket.id].player;
            var tangent = { x: -player.vy, y: player.vx };
            var speed = Math.sqrt(Math.pow(player.vx, 2) + Math.pow(player.vy, 2));
            players[socket.id].controls = { x: 0, y: 0 };
            if (data.right) {
                players[socket.id].controls.x -= tangent.x / speed * thrust;
                players[socket.id].controls.y -= tangent.y / speed * thrust;
            }
            if (data.left) {
                players[socket.id].controls.x += tangent.x / speed * thrust;
                players[socket.id].controls.y += tangent.y / speed * thrust;
            }
            if (data.forward) {
                players[socket.id].controls.x += player.vx / speed * thrust;
                players[socket.id].controls.y += player.vy / speed * thrust;
            }
            if (data.backward) {
                players[socket.id].controls.x -= player.vx / speed * thrust;
                players[socket.id].controls.y -= player.vy / speed * thrust;
            }
        }
    });

    socket.on('keyup', function (data) {
    });

    // Adjusts player shot power whenever they scroll
    socket.on('wheel', function (data) {
        var id = socket.id;
        if (players[id]) {
            if (players[id].player) {
                var player = players[id];
                if (data < 0) {
                    player.shotPower += shotPowerChangeRate;
                }

                if (data > 0) {
                    player.shotPower -= shotPowerChangeRate;
                }
                // Clamp values between shotPowerMin and shotPowerMax
                if (player.shotPower < shotPowerMin) {
                    player.shotPower = shotPowerMin;
                }
                if (player.shotPower > shotPowerMax) {
                    player.shotPower = shotPowerMax;
                }
            }
        }
    });

    socket.on('mousedown', function (data) {
        var id = socket.id;
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
    });

    // Fires the bullet when the mouse is released
    socket.on('mouseup', function (data) {
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
                        players[id].bulletCount = startingBulletCount;
                    }
                    if (currentTime - player.lastMouseUpTime > fireRate && players[id].bulletCount !== 0) {
                        players[id].bulletCount -= 1;
                        player.lastMouseUpTime = currentTime;
                        var bullet = new orbit.Mass(player.x, player.y, bulletRadius);
                        calculateShootingOrbit(shotPower, player, bullet);
                        bullet.id = socket.id;
                        bullet.type = "bullet"
                        bullets.push(deepCopy(bullet));
                    }
                } else if (data.button === 2) {
                    var player = players[id].player;
                    player.rightMouseDown = false;
                }
            }
        }
    });

    // Update the player's clientX and clientY position when they move their mouse
    socket.on('mousemove', function (data) {
        var id = socket.id;
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
    });

    // TODO: USE THIS FOR SOMETHING
    socket.on('mouseout', function (data) {
    });
});

// Update the game state every 15 ms
setInterval(function () {
    // Loop through the player list and update their position and velocity
    var allObjects = [];
    for (var id in players) {
        var player = players[id].player;
        var controls = players[id].controls;
        var shotPower = players[id].shotPower;

        if ((player.fuel > 0) && (controls.x || controls.y || player.rightMouseDown)) {

            // lower their fuel when controls are engaged
            player.fuel -= fuelDrainRate;
            // dont lower it too much though
            if (player.fuel < 0) {
                player.fuel = 0;
            }

            var mouseThrustForce = { x: 0, y: 0 };
            if (player.rightMouseDown === true && player.clientX && player.clientY) {
                mouseThrustForce = calculateThrustForce(thrust, player);
            }
            var controlForceMag = Math.sqrt(Math.pow(controls.x + mouseThrustForce.x, 2) + Math.pow(controls.y + mouseThrustForce.y, 2));
            var controlForce = {
                x: (controls.x + mouseThrustForce.x) / controlForceMag*thrust,
                y: (controls.y + mouseThrustForce.y) / controlForceMag*thrust
            };
            player.addForce(controlForce);
        }

        planet.addForce(player);
        player.update();

        // Player is pressing a movement control - recalculate the player orbit
        if (controls.x || controls.y || player.rightMouseDown) {
            var orbitParams = player.calculateOrbit(planet.mass);
            players[id].orbitParams = deepCopy(orbitParams);
        }

        // Player mouse is down - calculate the shooting orbit
        if (player.leftMouseDown === true) {
            var bullet = new orbit.Mass(player.x, player.y, bulletRadius);
            var orbitParams = calculateShootingOrbit(shotPower, player, bullet);
            shootingOrbits[id] = deepCopy(orbitParams);
        }
        allObjects.push(player);
    }

    // Calculate the bullet trajectories
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];
        planet.addForce(bullets[i]);
        bullet.update();
        allObjects.push(bullet);
    }

    // Add the earth as an object 
    allObjects.push(planet);

    map.objects = allObjects;
    map.updateCollisions();
    var collisions = map.collisions;

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
            var id = collisions[i].id;
            io.to(id).emit('youdied', 'You Died');
            delete players[id];
        }
    }

    var gameState = {
        players,
        bullets,
        shootingOrbits,
    };

    // Send the game state to the client to be rendered
    io.sockets.emit('gameState', gameState);

}, 15);