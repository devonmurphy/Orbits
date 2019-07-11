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
var database = require('./DataBaseController')

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ConnectionHandler = require('./ConnectionHandler.js');

var PORT = 5000;
var DOMAIN = '192.168.0.29';

var db = new database();
db.connect();

// Setup server to serve the client folder
app.set('port', PORT);
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/dist', express.static(path.join(__dirname, '../dist')));

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
app.get('/play', function (request, response) {
    if (request.sessionID && request.query) {
        var gameId = request.query.gameId;
        if (games[gameId] && games[gameId].type === 'create game' && !(request.sessionID in sessions)) {
            response.redirect('/game');
            sessions[request.sessionID] = { socket: undefined, gameId: gameId };
            return;
        }
    }
    response.redirect('/game');
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
var sessions = {};
var games = {};

var connectionHandler = new ConnectionHandler({
    io: io,
    sessions: sessions,
    games: games,
});

// Setup handlers to catch players joining and control input
io.use(sharedsession(session, {
    autoSave: true
}));

io.on('connection', (socket) => {
    connectionHandler.handleConnection(socket);
});

reload(app);