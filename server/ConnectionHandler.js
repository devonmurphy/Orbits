// Dependencies
var uid = require('uid-safe')
// Server dependencies
var Game = require('./game.js');

var PLAYERS_PER_GAME = 2;

class ConnectionHandler {
    constructor(opts) {
        this.sessions = opts.sessions;
        this.games = opts.games;
        this.io = opts.io;
    }

    setupSocketHandlers(socket) {
        var games = this.games;
        var sessions = this.sessions;
        var sessionID = socket.handshake.sessionID;
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
        socket.on("logout", function (userdata) {
            if (socket.handshake.session.userdata) {
                delete socket.handshake.session.userdata;
                socket.handshake.session.save();
            }
        });

        socket.on("Create Game", (playerCount) => {
            // Create a new game and with the player who created it
            var gameId = uid.sync(24);

            //Add the new player to the sessions object
            sessions[sessionID] = { socket: socket, gameId: gameId };

            var theGame = new Game({
                io: this.io,
                type: 'create game',
                gameId: gameId,
                playerSockets: [socket],
                playerCount: parseInt(playerCount),
                gameEnded: gameEnded,
                autoStart: true
            });
            games[gameId] = theGame;

            var gameLink = "localhost:5000/play?gameId=" + theGame.gameId;
            var data = {
                maxPlayers: theGame.playerCount,
                currentPlayers: theGame.playerSockets.length,
                gameLink: gameLink,
            };
            socket.emit('waiting for game', data);
        });

        socket.on("Join Game", (gameId) => {
            if (gameId in games && games[gameId].type === 'create game') {
                //Add the new player to the sessions object and connect them to the game
                sessions[sessionID] = { socket: socket, gameId: gameId };
                var theGame = games[gameId];
                theGame.connectPlayer(socket);
                if (theGame.players.length === theGame.playerCount) {
                    theGame.start();
                }
            }
        });

        socket.on("Single Player", (gameId) => {
            //Add the new player to the sessions object
            // Create a new game and with the player who created it
            var gameId = uid.sync(24);
            sessions[sessionID] = { socket: socket, gameId: gameId };
            var theGame = new Game({
                io: this.io,
                type: 'single player',
                gameId: gameId,
                playerSockets: [socket],
                gameEnded: gameEnded
            });
            theGame.start();
            games[gameId] = theGame;
        });

        // Logic to handle quickmatch
        socket.on("Quick Match", () => {
            console.log('quick match received');
            // If their sessionID is not in sessions - the player has just connected
            if (!(sessionID in sessions)) {
                console.log('new player');
                //Add the new player to the sessions object
                sessions[sessionID] = { socket: socket, gameId: undefined };

                // Check if there enough players for a new quickmatch game
                if (Object.keys(sessions).length % PLAYERS_PER_GAME === 0) {
                    console.log('starting game');

                    // Create a list of all the players who are not in a game
                    var players = [];
                    var gameId = uid.sync(24);
                    Object.keys(sessions).forEach((key, index) => {
                        if (!sessions[key].gameId) {
                            // Add them to the players list and store them in the sessions object
                            players.push(sessions[key].socket);
                            sessions[key].gameId = gameId;
                        }
                    });

                    // Create a new game with the players who are not in a game
                    var theGame = new Game({
                        io: this.io,
                        type: 'quick match',
                        gameId: gameId,
                        playerSockets: players,
                        gameEnded: gameEnded
                    });

                    // Start the game and add it to the games object
                    theGame.start();
                    games[gameId] = theGame;
                }
            } else {
                console.log('old player');
                // If a player already has a session in sessions they are reconnecting
                if (sessions[sessionID].gameId) {
                    // Store their old socket to a variable to be used to reconnect
                    var oldSocket = sessions[sessionID].socket;
                    // Update their socket
                    sessions[sessionID].socket = socket;
                    // Player is in a game currently - reconnect them
                    games[sessions[sessionID].gameId].reconnectPlayer(socket, oldSocket);
                    console.log('in game reconncting');
                } else {
                    // Player is not in a game, just update their socket 
                    sessions[sessionID].socket = socket;
                    console.log('not in game!');
                }
            }
        });
    }
    handleConnection(socket) {
        if (socket.handshake) {
            var games = this.games;
            var sessions = this.sessions;
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
                    var theGame = games[sessions[sessionID].gameId];
                    theGame.reconnectPlayer(socket, oldSocket);

                    if (theGame.type === 'create game') {
                        var gameLink = "localhost:5000/play?gameId=" + theGame.gameId;
                        var data = {
                            maxPlayers: theGame.playerCount,
                            currentPlayers: theGame.playerSockets.length,
                            gameLink: gameLink,
                        };
                        socket.emit('waiting for game', data);
                    } else {
                        socket.emit('waiting for game');
                    }
                } else {
                    console.log('player not in game');
                    // Player is not in a game, just update their socket 
                    sessions[sessionID].socket = socket;
                    socket.emit('waiting for game');
                }
            } else {
                socket.emit('game mode selection');
            }
            this.setupSocketHandlers(socket);
        }
    }
}

module.exports = ConnectionHandler;