import * as Renderer from "./Renderer.js";

// Intiates client connection and sets up controls 
var socket = io();

// Receive game state from server and then render it
socket.on('gameState', function (gameState) {
    Renderer.render(gameState);
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