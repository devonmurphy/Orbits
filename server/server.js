// Base code from https://hackernoon.com/how-to-build-a-multiplayer-browser-game-4a793818c29b
// Dependencies
var express = require('express');
var path = require('path');
var reload = require('reload');
var url = require('url');
var https = require('https')
var session = require('express-session')({
    secret: 'keyboard cat',
    genid: function (req) {
        return uid.sync(24);
    },
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 86400000
    }
});

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
var PORT = 8080;

var db = new database();
db.connect();

// Setup server to serve the client folder
app.set('port', PORT);
app.use('/client', express.static(path.join(__dirname, '../client')));

if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    sess.cookie.secure = true // serve secure cookies
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

    socket.on("logout", function (userdata) {
        if (socket.handshake.session.userdata) {
            delete socket.handshake.session.userdata;
            socket.handshake.session.save();
        }
    });

    if (socket.handshake) {
        var sessionID = socket.handshake.sessionID;

        // Player has just connected
        if (!(sessionID in sessions)) {
            playerCount += 1;
            console.log('logged in ' + sessionID);
            sessions[sessionID] = { socket: socket, gameId: undefined };

            if (playerCount % PLAYERS_PER_GAME === 0) {
                var players = [];
                Object.keys(sessions).forEach(function (key, index) {
                    if (!sessions[key].gameId) {
                        players.push(sessions[key].socket);
                        sessions[key].gameId = playerCount;
                    }
                });
                var theGame = new game(io, playerCount, players);
                theGame.runGame();
                games[playerCount] = theGame;
            }
        } else {
            // Player is reconnecting
            console.log('reconnected ' + sessionID);
            if (sessions[sessionID].gameId) {
                console.log('player already in game - reconnecting ' + sessionID);
                var oldSocket = sessions[sessionID].socket;
                sessions[sessionID].socket = socket;
                games[sessions[sessionID].gameId].reconnectPlayer(socket, oldSocket);
            } else {
                console.log('player still waiting for game ' + sessionID);
                sessions[sessionID].socket = socket;
            }
        }
    }
});

// Reload code here
reload(app);