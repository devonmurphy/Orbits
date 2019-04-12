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

// Stores a dictionary of players using socket id as the key
var players = {};
var bullets = [];
var shootingOrbits = {};
var thrust = 125;
var shotPower = 500;
var mass = orbit.mass;

function deepCopy(obj) {
    var copy = Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
    return copy;
}

// Setup handlers to catch5players joining and control input
io.on('connection', function (socket) {
    // Assign the first two players that join to 1 or 2
    socket.on('new player', function () {
        // Create the player
        var sign = (Object.keys(players).length % 2 === 0 ? -1 : 1);
        var sharedPlayer = new orbit.Mass(sign * 4000, 0);

        var dist = Math.sqrt(Math.pow(sharedPlayer.x, 2) + Math.pow(sharedPlayer.y, 2));
        var circularOrbitVel = Math.sqrt(mass / dist);
        sharedPlayer.vy = -sign * circularOrbitVel;
        var orbitParams = sharedPlayer.calculateOrbit();
        players[socket.id] = {
            player: deepCopy(sharedPlayer),
            orbitParams: deepCopy(orbitParams),
            controls: { x: 0, y: 0 },
            thrust: 10,
        };
    });
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

    socket.on('mousedown', function (data) {
        var id = socket.id;
        if (players[id]) {
            if (players[id].player) {
                var player = players[id].player;
                player.mouseDown = true;
            }
        }
        //drawShootingOrbit = true;
    });

    socket.on('mouseup', function (data) {
        //drawShootingOrbit = false;
        // Fire the bullet
        var id = socket.id;

        if (players[id]) {
            if (players[id].player) {
                var player = players[id].player;
                player.mouseDown = false;
                var bullet = new orbit.Mass(player.x, player.y);
                var dist = magnitude(player.clientX, player.clientY, player.x, player.y);
                bullet.vx = player.vx + shotPower * (player.clientX - player.x) / dist;
                bullet.vy = player.vy + shotPower * (-player.clientY - player.y) / dist;
                bullet.id = socket.id;
                bullet.calculateOrbit();
                bullets.push(deepCopy(bullet));
            }
        }
    });

    socket.on('mousemove', function (data) {
        var id = socket.id;
        if (players[id]) {
            if (players[id].player) {
                var player = players[id].player;
                if (player.mouseDown === true) {
                    player.clientX = data.clientX;
                    player.clientY = data.clientY;
                }
            }
            /*
            if (drawShootingOrbit === true) {
                var shootX = data.clientX - player.x;
                var shootY = data.clientY - player.y;
            }
            */
        }
    });
    socket.on('mouseout', function (data) {
    });
});


var magnitude = function (x1, y1, x2, y2) {
    var x = x2 - x1;
    var y = y2 - y1;
    return Math.sqrt(x * x + y * y);
}

// Update the game state every 15 ms
setInterval(function () {
    for (var id in players) {
        var player = players[id].player;
        var controls = players[id].controls;
        var dist = Math.sqrt(Math.pow(player.x, 2) + Math.pow(player.y, 2));
        var gravity = {
            x: -mass * player.x / (dist * dist * dist),
            y: -mass * player.y / (dist * dist * dist),
        };

        player.addForce(gravity);
        player.addForce(controls);
        var state = player.update();
        if (controls.x || controls.y) {
            var orbitParams = player.calculateOrbit();
            players[id].orbitParams = deepCopy(orbitParams);
        }

        if (player.mouseDown === true) {
            var bullet = new orbit.Mass(player.x, player.y);
            var dist = magnitude(player.clientX, player.clientY, player.x, player.y);
            bullet.vx = player.vx + shotPower * (player.clientX - player.x) / dist;
            bullet.vy = player.vy + shotPower * (-player.clientY - player.y) / dist;
            var orbitParams = bullet.calculateOrbit();
            shootingOrbits[id] = deepCopy(orbitParams);
        }
    }

    // Calculate the bullet trajectories
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];
        var dist = Math.sqrt(Math.pow(bullet.x, 2) + Math.pow(bullet.y, 2));
        var gravity = {
            x: -mass * bullet.x / (dist * dist * dist),
            y: -mass * bullet.y / (dist * dist * dist),
        };
        bullet.addForce(gravity);
        bullet.update();
    }

    var gameState = {
        players,
        bullets,
        shootingOrbits,
    };

    // Send the game state to the client to be rendered
    io.sockets.emit('gameState', gameState);

}, 15);