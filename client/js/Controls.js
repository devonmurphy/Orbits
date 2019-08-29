import * as Renderer from "./Renderer.js";
import socket from "./Socket.js"

var canvas = document.getElementById('renderer');
var movement = { right: false, left: false, forward: false, backward: false }

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
        clientX: (event.clientX - Renderer.offsetLeft) / Renderer.gameScale,
        clientY: (event.clientY - Renderer.offsetTop) / Renderer.gameScale,
        button: event.button,
    };
    socket.emit('mousedown', data);
});

canvas.addEventListener("mouseup", function (event) {
    var data = {
        clientX: (event.clientX - Renderer.offsetLeft) / Renderer.gameScale,
        clientY: (event.clientY - Renderer.offsetTop) / Renderer.gameScale,
        button: event.button,
    };
    socket.emit('mouseup', data);
});

canvas.addEventListener("mousemove", function (event) {
    var data = {
        clientX: (event.clientX - Renderer.offsetLeft) / Renderer.gameScale,
        clientY: (event.clientY - Renderer.offsetTop) / Renderer.gameScale,
    };
    socket.emit('mousemove', data);
});

canvas.addEventListener("mouseout", function (event) {
    var data = {
        clientX: (event.clientX - Renderer.offsetLeft) / Renderer.gameScale,
        clientY: (event.clientY - Renderer.offsetTop) / Renderer.gameScale,
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