// Base code from https://hackernoon.com/how-to-build-a-multiplayer-browser-game-4a793818c29b
// Dependencies
var express = require('express');
var path = require('path');
var reload = require('reload');
var url = require('url');
var https = require('https')
var sharedsession = require("express-socket.io-session");
var uid = require('uid-safe')

// Server dependencies
var googleapi = require('./google-utils')
var database = require('./database')

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var game = require('./game.js');
var utils = require('./utils');

var PLAYERS_PER_GAME = 2;
var PORT = 5000;

var db = new database();
db.connect();

// Setup server to serve the client folder
app.set('port', PORT);
app.use('/client', express.static(path.join(__dirname, '../client')));

var session = require('express-session')({
    secret: 'keyboard cat',
    genid: function (req) {
        return uid.sync(24);
    },
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 86400000,
        secure: app.get('env') === 'production' ? true : false
    }
});

if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
}

app.use(session);

// Routing to main page
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, '../client/html/index.html'));
});

// Routing to game
app.get('/game', function (request, response) {
    if (app.get('env') !== 'production') {
        if (request.sessionID) {
            response.sendFile(path.join(__dirname, '../client/html/game.html'));
            return;
        }
    }
    if (request.query) {
        var checkUser = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + request.query.user;
        https.get(checkUser, (resp) => {
            // Continuously update stream with data
            var body = '';
            resp.on('data', function (d) {
                body += d;
            });
            resp.on('end', function () {
                // Data reception is done, do whatever with it!
                var parsed = JSON.parse(body);
                if (parsed.expires_in > 0) {
                    response.sendFile(path.join(__dirname, '../client/html/game.html'));
                } else {
                    response.redirect('/login');
                }
            });
        });
    } else {
        response.redirect('/login');
    }
});

// Routing to game
app.get('/login', function (request, response) {
    if (app.get('env') !== 'production') {
        response.redirect('/game');
        return;
    }
    response.redirect(googleapi.urlGoogle());
});

app.get('/auth/google/callback', function (request, response) {
    if (request.query) {
        var result = googleapi.getGoogleAccountFromCode(request.query.code);
        result.then((result) => {
            db.checkUserExists(result.email);
            response.redirect(url.format({
                pathname: '/game',
                query: {
                    user: result.tokens.access_token
                }
            }));
        });
    }
});

// Starts the server
server.listen(PORT, function () {
    console.log('Starting server on port ' + PORT);
});

// These variables are for storing all players and games
var playerCount = 0;
var sessions = {};
var games = {};

// Setup handlers to catch players joining and control input
io.use(sharedsession(session, {
    autoSave: true
}));

io.on('connection', function (socket) {
    if (socket.handshake) {
        socket.on("logout", function (userdata) {
            if (socket.handshake.session.userdata) {
                delete socket.handshake.session.userdata;
                socket.handshake.session.save();
            }
        });

        var sessionID = socket.handshake.sessionID;
        // If their sessionID is in sessions - the player is reconnecting
        if (sessionID in sessions) {
            // If a player already has a session in sessions they are reconnecting
            if (sessions[sessionID].gameId) {
                // Store their old socket to a variable to be used to reconnect
                var oldSocket = sessions[sessionID].socket;
                // Update their socket
                sessions[sessionID].socket = socket;
                // Player is in a game currently - reconnect them
                games[sessions[sessionID].gameId].reconnectPlayer(socket, oldSocket);
            } else {
                // Player is not in a game, just update their socket 
                sessions[sessionID].socket = socket;
                socket.emit('waiting for game');
            }
        } else {
            socket.emit('game mode selection');
        }
        // This callback function is ran when the game ends
        var gameEnded = function (gameId) {
            console.log('game id ended: ' + gameId);
            Object.keys(sessions).forEach(function (key, index) {
                // Delete the sessions so they can rejoin other games
                if (sessions[key].gameId === gameId) {
                    delete sessions[key];
                }
            });
            // Remove the game from the games object
            delete games[gameId];
        }

        socket.on("create game", function (gameName) {
            //Add the new player to the sessions object
            sessions[sessionID] = { socket: socket, gameId: undefined };
            // Create a new game and with the player who created it
            var gameId = uid.sync(24);
            var theGame = new game(io, uid.sync(24), [socket], gameEnded);
            theGame.type = 'create game';
            games[gameId] = theGame;
        });

        socket.on("join game", function (gameId) {
            if (gameId in games && games[gameId].type === 'create game') {
                //Add the new player to the sessions object and connect them to the game
                sessions[sessionID] = { socket: socket, gameId: gameId };
                var theGame = games[gameId];
                theGame.connectPlayer(socket);
            }
        });

        // Logic to handle quickmatch
        socket.on("quickmatch", function () {
            // If their sessionID is not in sessions - the player has just connected
            if (!(sessionID in sessions)) {
                // Increase the total player count since a new player arrived
                playerCount += 1;
                //Add the new player to the sessions object
                sessions[sessionID] = { socket: socket, gameId: undefined };

                // Check if there enough players for a new quickmatch game
                if (playerCount % PLAYERS_PER_GAME === 0) {

                    // Create a list of all the players who are not in a game
                    var players = [];
                    Object.keys(sessions).forEach(function (key, index) {
                        if (!sessions[key].gameId) {
                            // Add them to the players list and store them in the sessions object
                            players.push(sessions[key].socket);
                            sessions[key].gameId = playerCount;
                        }
                    });

                    // Create a new game with the players who are not in a game
                    var theGame = new game(io, playerCount, players, gameEnded);
                    theGame.type = 'quickmatch';

                    // Start the game and add it to the games object
                    theGame.runGame();
                    games[playerCount] = theGame;
                }
            } else {
                // If a player already has a session in sessions they are reconnecting
                if (sessions[sessionID].gameId) {
                    // Store their old socket to a variable to be used to reconnect
                    var oldSocket = sessions[sessionID].socket;
                    // Update their socket
                    sessions[sessionID].socket = socket;
                    // Player is in a game currently - reconnect them
                    games[sessions[sessionID].gameId].reconnectPlayer(socket, oldSocket);
                } else {
                    // Player is not in a game, just update their socket 
                    sessions[sessionID].socket = socket;
                }
            }
        });
    }
});

// Reload code here
reload(app);