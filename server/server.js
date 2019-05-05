// Base code from https://hackernoon.com/how-to-build-a-multiplayer-browser-game-4a793818c29b
// Dependencies
var express = require('express');
var path = require('path');
var reload = require('reload');
var orbit = require('./orbits.js');
var map = require('./map.js');

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var game = require('./game.js');

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

// Setup handlers to catch players joining and control input
var playerCount = 0;
var playerSockets = [];

io.on('connection', function (socket) {
    playerSockets.push(socket);
    playerCount += 1;
    if (playerCount === 2) {
        var gamePlayers = [
            playerSockets[0],
            playerSockets[1]
        ];
        var game1 = new game(io, "1", gamePlayers);
    }
    if (playerCount === 4) {
        var game2 = new game(io, "2", [playerSockets[2], playerSockets[3]]);
    }
});

// Reload code here
reload(app);