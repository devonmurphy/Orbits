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

var game = require('./game.js')(io);
console.log(game);

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