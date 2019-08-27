// Dependencies
var uid = require('uid-safe')
// Server dependencies
var Game = require('./Game.js');
var utils = require('./utils.js');

var PLAYERS_PER_GAME = 2;
var DOMAIN = utils.getIPAddress();
var PORT = 5000;

class ConnectionHandler {
    constructor(opts) {
        this.sessions = opts.sessions;
        this.games = opts.games;
        this.io = opts.io;
        this.quickMatchPlayers = 0;
    }

    sendWaitingForGame(theGame) {
        var gameLink = DOMAIN + ":" + PORT + "/play?gameId=" + theGame.gameId;
        var data = {
            maxPlayers: theGame.playerCount,
            currentPlayers: Object.keys(theGame.players).length,
            gameLink: gameLink,
        };
        // Send the game state to the client to be rendered
        this.io.sockets.in(theGame.gameId).emit('waiting for game', data);
    }

    setupSocketHandlers(socket) {
        var games = this.games;
        var sessions = this.sessions;
        var sessionID = socket.handshake.sessionID;
        // This callback function is ran when the game ends

        var gameEnded = function (gameId) {
            Object.keys(sessions).forEach(function (key) {
                // Delete the sessions so they can rejoin other games
                if (sessions[key].gameId === gameId) {
                    sessions[key].gameId = undefined;
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

        socket.on("login", function (name) {
            if (sessionID in sessions) {
                sessions[sessionID].socket = socket;
                sessions[sessionID].name = name
            } else {
                sessions[sessionID] = { socket: socket, name: name };
            }
        });

        socket.on("Create Game", (playerCount) => {
            // Create a new game and with the player who created it
            var gameId = uid.sync(24);

            //Add the new player to the sessions object
            sessions[sessionID].socket = socket;
            sessions[sessionID].gameId = gameId;

            var theGame = new Game({
                io: this.io,
                type: 'create game',
                gameId: gameId,
                playerCount: parseInt(playerCount),
                gameEnded: gameEnded,
                autoStart: true
            });
            games[gameId] = theGame;
            theGame.connectPlayer(sessions[sessionID], socket);
            this.sendWaitingForGame(theGame);
        });

        socket.on("Join Game", (gameId) => {
            if (gameId in games && games[gameId].type === 'create game') {
                //Add the new player to the sessions object and connect them to the game
                sessions[sessionID].socket = socket;
                sessions[sessionID].gameId = gameId;
                var theGame = games[gameId];
                theGame.connectPlayer(sessions[sessionID], socket);
                if (theGame.players.length === theGame.playerCount) {
                    theGame.start();
                }
            }
        });

        socket.on("Single Player", (gameId) => {
            //Add the new player to the sessions object
            // Create a new game and with the player who created it
            var gameId = uid.sync(24);
            sessions[sessionID].socket = socket;
            sessions[sessionID].gameId = gameId;
            var theGame = new Game({
                io: this.io,
                type: 'single player',
                gameId: gameId,
                playerCount: 1,
                gameEnded: gameEnded
            });
            theGame.connectPlayer(sessions[sessionID], socket);
            theGame.start();
            games[gameId] = theGame;
        });

        // Logic to handle quickmatch
        socket.on("Quick Match", () => {

            if ((sessionID in sessions) && (!sessions[sessionID].gameId)) {
                // A new quick match player has joined
                this.quickMatchPlayers += 1;

                // Create a new game if needed - this player will join
                if ((this.quickMatchPlayers - 1) % PLAYERS_PER_GAME === 0) {
                    var gameId = uid.sync(24);

                    // Set currentQuickMatch to the game id just created
                    this.currentQuickMatch = gameId;

                    //Add the new player to the sessions object
                    sessions[sessionID].socket = socket;
                    sessions[sessionID].gameId = gameId;

                    // Create a new game that will autostart when full
                    var theGame = new Game({
                        io: this.io,
                        type: 'quick match',
                        gameId: gameId,
                        playerCount: PLAYERS_PER_GAME,
                        gameEnded: gameEnded,
                        autoStart: true
                    });

                    // Join the player who just sent "Quick Match" 
                    games[gameId] = theGame;
                    theGame.connectPlayer(sessions[sessionID], socket);
                } else {
                    // New game did not need to made - join existing game
                    var theGame = games[this.currentQuickMatch];
                    var gameId = theGame.gameId;

                    sessions[sessionID].socket = socket;
                    sessions[sessionID].gameId = gameId;
                    theGame.connectPlayer(sessions[sessionID], socket);
                }

            } else if ((sessionID in sessions) && (sessions[sessionID].gameId)) {
                // If a player already has a gameId and session then they are reconnecting
                // Store their old socket to a variable to be used to reconnect
                var oldSocket = sessions[sessionID].socket;
                // Update their socket
                sessions[sessionID].socket = socket;
                // Player is in a game currently - reconnect them
                theGame.reconnectPlayer(socket, oldSocket, sessions[sessionID]);
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

                    // Player hasn't logged in yet send them login screen
                    if (!sessions[sessionID].name) {
                        // Player has not logged in yet
                        socket.emit('login');
                    } else {
                        // Player is in a game currently - reconnect them
                        var theGame = games[sessions[sessionID].gameId];

                        if (theGame.type === 'create game') {
                            var oldSocket = sessions[sessionID].socket;
                            if (!oldSocket) {
                                sessions[sessionID].socket = socket;
                                theGame.connectPlayer(sessions[sessionID], socket);
                            } else {
                                if (oldSocket.id in theGame.players) {
                                    sessions[sessionID].socket = socket;
                                    theGame.reconnectPlayer(socket, oldSocket, sessions[sessionID]);
                                } else {
                                    sessions[sessionID].socket = socket;
                                    theGame.connectPlayer(sessions[sessionID], socket);
                                }
                            }
                            this.sendWaitingForGame(theGame);
                        } else {
                            // Store their old socket to a variable to be used to reconnect
                            var oldSocket = sessions[sessionID].socket;
                            // Update their socket
                            sessions[sessionID].socket = socket;
                            theGame.reconnectPlayer(socket, oldSocket, sessions[sessionID]);
                            socket.emit('waiting for game');
                        }
                    }
                } else {
                    // Player is not in a game, just update their socket 
                    sessions[sessionID].socket = socket;
                    socket.emit('game mode selection');
                }
            } else {
                // Player has not logged in yet
                socket.emit('login');
            }
            this.setupSocketHandlers(socket);
        }
    }
}

module.exports = ConnectionHandler;