// Base code from https://hackernoon.com/how-to-build-a-multiplayer-browser-game-4a793818c29b
// Dependencies
var express = require('express');
var path = require('path');
var reload = require('reload');

var orbit = require('./orbits.js');
var map = require('./map.js');
var googleapi = require('./google-utils')

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var game = require('./game.js');

var PLAYERS_PER_GAME = 2;
var PORT = 8080;

// Setup server to serve the client folder
app.set('port', PORT);
app.use('/client', express.static(path.join(__dirname, '../client')));

// Routing to main page
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, '../client/html/index.html'));
});

// Routing to game
app.get('/game', function (request, response) {
    response.sendFile(path.join(__dirname, '../client/html/game.html'));
});

// Routing to game
app.get('/login', function (request, response) {
    response.redirect(googleapi.urlGoogle());
});

app.get('/auth/google/callback', function (request, response) {
    if(request.query){
        var result = (googleapi.getGoogleAccountFromCode(request.query.code));
    } 
    response.sendFile(path.join(__dirname, '../client/html/login.html'));
});

// Starts the server
server.listen(PORT, function () {
    console.log('Starting server on port ' + PORT);
});

// Setup handlers to catch players joining and control input
var playerCount = 0;
var playerSockets = [];

io.on('connection', function (socket) {
    playerSockets.push(socket);
    playerCount += 1;
    if (playerCount % PLAYERS_PER_GAME === 0) {
        var theGame = new game(io, playerCount, playerSockets.slice(playerCount - PLAYERS_PER_GAME, playerCount));
        theGame.runGame();
    }
});

// Reload code here
reload(app);