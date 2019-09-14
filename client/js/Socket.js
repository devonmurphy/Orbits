import * as Renderer from "./Renderer.js";
import * as Game from "./server/Game.js";

var theGame = undefined;
theGame = new Game({
    io: this,
    type: 'single player',
    gameId: 'localGame',
    playerCount: 1,
});

// Intiates client connection and sets up controls 
var socket = io();

// Receive game state from server and then render it
socket.on('gameState', function (gameState) {
    if (!theGame.started) {
        // Create a new game and with the player who created it
        theGame.connectPlayer('localPlayer', this);
        theGame.start();
    }
    theGame.updateGameState(gameState);
});

// Receive you died 
socket.on('youdied', function (data) {
    Renderer.setPlayerDead();
});

// Receive you won
socket.on('youwon', function (data) {
    Renderer.setPlayerWon();
});

// Receive you won
socket.on('starting game', function (data) {
    document.getElementById('renderer').style.display = 'block';
    //Add the new player to the sessions object
    // Create a new game with the local player
    if (!theGame.started) {
        // Create a new game and with the player who created it
        theGame.connectPlayer('localPlayer', this);
        theGame.start();
    }
});

// Render waiting for game screen
socket.on('login', function () {
    Renderer.createLogin();
});

// Render waiting for game screen
socket.on('game mode selection', function () {
    Renderer.createGameSelectBtns();
});

// Render waiting for game screen
socket.on('waiting for game', function (data) {
    Renderer.waitingForGame(data);
});

export default socket;