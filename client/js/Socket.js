import * as Renderer from "./Renderer.js";
import * as Game from "./server/Game.js";

var theGame;
// Intiates client connection and sets up controls 
var socket = io();

// Receive game state from server and then render it
socket.on('gameState', function (gameState) {
    Renderer.render(gameState);
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
    // Create a new game and with the player who created it
    theGame = new Game({
        io: this,
        type: 'single player',
        gameId: 'jahsdjhajkdshjkd78as8d',
        playerCount: 1,
    });
    theGame.connectPlayer('asjkdhkajsdhjkhadjkshjkdjk', this);
    theGame.start();
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