
// Intiates client connection and sets up controls 
var socket = io();

var movement = { right: false, left: false, forward: false, backward: false }
var canvas = document.getElementById('renderer');
var context = canvas.getContext("2d");
var offsetLeft = canvas.offsetLeft + canvas.width / 2;
var offsetTop = canvas.offsetTop + canvas.height / 2;

// Scale and size
var orbitLineWidth = "50";
var earthRadius = 1500;
var gameScale = .03;

// Resize canvas to window size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight

var playerDead = false;
var playerWon = false;

// Start movement when keys are pressed down
document.addEventListener('keydown', function (event) {
    switch (event.keyCode) {
        case 65: // A
            movement.left = true;
            break;
        case 87: // W
            movement.forward = true;
            break;
        case 68: // D
            movement.right = true;
            break;
        case 83: // S
            movement.backward = true;
            break;
    }
    socket.emit('movement', movement);
});

// Stop movement when keys are released
document.addEventListener('keyup', function (event) {
    switch (event.keyCode) {
        case 65: // A
            movement.left = false;
            break;
        case 87: // W
            movement.forward = false;
            break;
        case 68: // D
            movement.right = false;
            break;
        case 83: // S
            movement.backward = false;
            break;
    }
    socket.emit('movement', movement);
});

canvas.addEventListener("mousedown", function (event) {
    var data = {
        clientX: (event.clientX - offsetLeft) / gameScale,
        clientY: (event.clientY - offsetTop) / gameScale,
        button: event.button,
    };
    socket.emit('mousedown', data);
});

canvas.addEventListener("mouseup", function (event) {
    var data = {
        clientX: (event.clientX - offsetLeft) / gameScale,
        clientY: (event.clientY - offsetTop) / gameScale,
        button: event.button,
    };
    socket.emit('mouseup', data);
});

canvas.addEventListener("mousemove", function (event) {
    var data = {
        clientX: (event.clientX - offsetLeft) / gameScale,
        clientY: (event.clientY - offsetTop) / gameScale,
    };
    socket.emit('mousemove', data);
});

canvas.addEventListener("mouseout", function (event) {
    var data = {
        clientX: (event.clientX - offsetLeft) / gameScale,
        clientY: (event.clientY - offsetTop) / gameScale,
    };
    socket.emit('mouseout', data);
});

// Capture scroll wheel and send data
canvas.addEventListener('wheel', function (event) {
    //Send the wheel Y axis scroll event to server
    socket.emit('wheel', event.deltaY)
    // This prevents the page from scrolling
    event.preventDefault();
});

canvas.addEventListener('contextmenu', function (e) {
    if (e.button == 2) {
        // Block right-click menu thru preventing default action.
        e.preventDefault();
    }
});

// Receive game state from server and then render it
socket.on('gameState', function (gameState) {
    render(gameState);
});

// Receive you died 
socket.on('youdied', function (data) {
    playerDead = true;
});

// Receive you won
socket.on('youwon', function (data) {
    playerWon = true;
});