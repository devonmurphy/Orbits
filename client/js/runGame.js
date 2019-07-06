// Intiates client connection and sets up controls 
var socket = io();

import React from "react";
import ReactDOM from "react-dom";
import GameSelectBtn from "./GameSelectBtn.js";

function removeElementsByClass(className) {
    var elements = document.getElementsByClassName(className);
    while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
    }
}

var createGameSelectBtns = function () {
    var singlePlayerOnClick = () => {
        socket.emit('Single Player');
        waitingForGame();
    }

    var quickMatchOnClick = () => {
        socket.emit('Quick Match');
        waitingForGame();
    }

    ReactDOM.render(
        <GameSelectBtn quickMatchOnClick={quickMatchOnClick} singlePlayerOnClick={singlePlayerOnClick} />,
        document.getElementById('root')
    );
}

var movement = { right: false, left: false, forward: false, backward: false }
var canvas = document.getElementById('renderer');
var context = canvas.getContext("2d");
var offsetLeft = canvas.offsetLeft + canvas.width / 2;
var offsetTop = canvas.offsetTop + canvas.height / 2;

// Scale and size
var orbitLineWidth = "50";
var earthRadius = 1500;
var gameScale = .03;

var uiX = 12500;
var uiY = 12000;

// Resize canvas to window size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight

// Colors
var outOfBoundsColor = "#000011";
var gameBackgroundColor = "#000022";
var earthColor = "#a6ff99";

var playerColor = "#1f9fef";
var orbitLineColor = "#a329e0";
var playerShootingLineColor = "#1f9fef";
var playerBulletColor = "#1f9fef";

var enemyColor = "#ff0066";
var enemyOrbitLineColor = "#ffcc00";
var enemyBulletColor = "#ff0066";

var playerDead = false;
var playerWon = false;

var DEBUG_LINE = false;
var DEBUG_MAP = false;


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

var waitingForGame = function () {
    // Remove Game select btns and display canvas;
    removeElementsByClass('GameSelectBtns')
    document.getElementById('renderer').style.display = 'block';

    // Reset canvas and draw background
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = outOfBoundsColor;
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.fill();

    // Move canvas origin to center and zoom out
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(gameScale, gameScale);

    context.font = "2000px Garamond Pro";
    context.fillStyle = "white";
    canvas.style.letterSpacing = -10;
    context.textAlign = "center";
    context.fillText("WAITING FOR OPPONENT...", 0, -5000);

    removeGameModeSelection();
}

var createGame = function () {
    // Reset canvas and draw background
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = outOfBoundsColor;
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.fill();

    // Move canvas origin to center and zoom out
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(gameScale, gameScale);

    var textBox = document.createElement("INPUT");
    textBox.setAttribute("type", "text");
    textBox.id = "game name";
    document.body.appendChild(textBox);

    var submitGameName = createButton(0, 200, 'Submit', function () {
        var gameName = document.getElementById("Submit").value;
        socket.emit('create game', gameName);
    });

    removeGameModeSelection();
}

var gameModeSelection = function () {
    // Reset canvas and draw background
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = outOfBoundsColor;
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.fill();

    // Move canvas origin to center and zoom out
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(gameScale, gameScale);

    /*
    createButton(0, -100, 'Single Player', function () {
        socket.emit('single player');
        waitingForGame();
    });
    createButton(0, 100, 'Create Game', function () {
        socket.emit('create game');
        createGame();
    });

    createButton(0, 200, 'Join Game', function () {
        socket.emit('join game');
        waitingForGame();
    });
    */

    createGameSelectBtns();
}

var removeGameModeSelection = function () {
    // Remove the old menu
    if (document.getElementById("Single Player")) {
        document.getElementById("Single Player").outerHTML = "";
    }
    if (document.getElementById("Quick Match")) {
        document.getElementById("Quick Match").outerHTML = "";
    }
    if (document.getElementById("Create Game")) {
        document.getElementById("Create Game").outerHTML = "";
    }
    if (document.getElementById("Join Game")) {
        document.getElementById("Join Game").outerHTML = "";
    }
}

// Render waiting for game screen
socket.on('game mode selection', function () {
    gameModeSelection();
});

// Render waiting for game screen
socket.on('waiting for game', function () {
    waitingForGame();
});

var drawEarth = function () {
    // Draw Earth
    context.fillStyle = earthColor;
    context.beginPath();
    context.arc(0, 0, earthRadius, 0, 2 * Math.PI);
    context.fill();
}

var drawPlayers = function (players) {
    for (var id in players) {
        if (socket.id === id) {
            context.strokeStyle = orbitLineColor;

            if (players[id]) {
                var ellipse = players[id].orbitParams.ellipse;
                var points = players[id].orbitParams.points;

            }
            // Draw Elliptical orbit
            if (ellipse) {

                context.beginPath();
                context.lineWidth = orbitLineWidth;
                context.ellipse(ellipse.x, ellipse.y, ellipse.a, ellipse.b, ellipse.w, 0, 2 * Math.PI);
                context.stroke();
            }

            // Draw Hyperbolic orbit
            if (points) {
                context.beginPath();
                context.lineWidth = orbitLineWidth;
                for (var pos = 0; pos < points.length - 1; pos++) {
                    context.moveTo(points[pos].x, points[pos].y);
                    context.lineTo(points[pos + 1].x, points[pos + 1].y);
                }
                context.stroke();
            }
        }

        // Draw player
        var player = players[id].player;
        if (socket.id === id) {
            context.fillStyle = playerColor;
        } else {
            context.fillStyle = enemyColor;
        }
        context.beginPath();
        context.arc(player.x, -player.y, player.radius, 0, 2 * Math.PI);
        context.fill();
    }
}

var drawBullets = function (bullets) {
    for (var i = 0; i < bullets.length; i++) {
        if (socket.id === bullets[i].id) {
            context.fillStyle = playerBulletColor;
        } else {
            context.fillStyle = enemyBulletColor;
        }
        context.beginPath();
        context.arc(bullets[i].x, -bullets[i].y, bullets[i].radius, 0, 2 * Math.PI);
        context.fill();
    }

}

var drawShootingOrbits = function (shootingOrbits) {
    // Draw orbits
    if (!shootingOrbits[socket.id]) {
        return
    }
    var ellipse = shootingOrbits[socket.id].ellipse;
    var points = shootingOrbits[socket.id].points;

    // Draw Elliptical orbit
    if (ellipse) {
        context.beginPath();
        context.strokeStyle = playerShootingLineColor;
        context.lineWidth = orbitLineWidth;
        context.ellipse(ellipse.x, ellipse.y, ellipse.a, ellipse.b, ellipse.w, 0, 2 * Math.PI);
        context.stroke();
    }

    // Draw Hyperbolic orbit
    if (points) {
        if (!DEBUG_LINE) {
            context.beginPath();
            context.strokeStyle = playerShootingLineColor;
            context.lineWidth = orbitLineWidth;
            for (var pos = 0; pos < points.length - 1; pos++) {
                context.moveTo(points[pos].x, points[pos].y);
                context.lineTo(points[pos + 1].x, points[pos + 1].y);
            }
            context.stroke();
        } else {
            // DEBUG LINE MODE TO SEE POINTS
            context.strokeStyle = playerShootingLineColor;
            context.lineWidth = orbitLineWidth;
            var colors = ["green", "cyan", "purple", "red", "yellow", "orange"];
            for (var pos = 0; pos < points.length - 1; pos++) {
                context.beginPath();
                context.strokeStyle = colors[pos % colors.length];
                context.moveTo(points[pos].x, points[pos].y);
                context.lineTo(points[pos + 1].x, points[pos + 1].y);
                context.stroke();
            }
        }
    }

}

var drawGameUI = function (localPlayer, strikes, maxStrikes) {

    context.font = "600px Verdana";
    context.fillStyle = "white";
    context.textAlign = "center";
    context.fillText("score: " + localPlayer.score, uiX - 850, uiY - 600);

    context.font = "600px Verdana";
    context.fillStyle = "white";
    context.textAlign = "center";

    if (localPlayer.bulletCount !== null) {
        context.fillText("bullets: " + localPlayer.bulletCount, uiX - 850, uiY);
    }

    context.font = "600px Verdana";
    context.fillStyle = "white";
    context.textAlign = "center";

    if (strikes !== null) {
        context.fillText("strikes: " + strikes + "/" + maxStrikes, uiX - 720, uiY);
    }

    context.font = "600px Verdana";
    context.fillStyle = "white";
    context.textAlign = "center";

    if (localPlayer.player.fuel !== null) {
        context.fillText("fuel: " + localPlayer.player.fuel, uiX, uiY + 600);
    }
}

//  Render based on game state received from server
var render = function (gameState) {
    var players = gameState.players;
    var bullets = gameState.bullets;
    var shootingOrbits = gameState.shootingOrbits;
    var localPlayer = players[socket.id];
    var strikes = gameState.strikes;
    var maxStrikes = gameState.maxStrikes;


    // Resize canvas to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight

    // Recalculate offset
    offsetLeft = canvas.offsetLeft + canvas.width / 2;
    offsetTop = canvas.offsetTop + canvas.height / 2;

    // Reset canvas and draw background
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Render out of bounds area
    context.fillStyle = outOfBoundsColor;
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.fill();

    // Move canvas origin to center and zoom out
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(gameScale, gameScale);

    if (gameState.map) {
        var map = gameState.map;
        // Render game area
        context.fillStyle = gameBackgroundColor;
        context.beginPath();
        context.arc(0, 0, map.mapRadius, 0, 2 * Math.PI);
        context.fill();
    }

    if (gameState.map && DEBUG_MAP) {
        var map = gameState.map.map;
        var colors = ["green", "cyan", "purple", "red", "yellow", "orange"];
        for (var i = 0; i < map.length; i++) {
            context.beginPath();
            context.fillStyle = colors[i % colors.length];
            context.rect(map[i].x, map[i].y, gameState.map.gridSize, gameState.map.gridSize);
            context.fill();
        }
    }

    // Draw everthing
    drawPlayers(players);
    drawBullets(bullets);
    drawEarth();
    drawShootingOrbits(shootingOrbits);

    if (localPlayer) {
        drawGameUI(localPlayer, strikes, maxStrikes);
    }
    if (playerDead === true) {
        context.font = "3000px Garamond Pro";
        context.fillStyle = "#d63515";
        canvas.style.letterSpacing = -30;
        context.textAlign = "center";
        context.fillText("YOU DIED", 0, -5000);
    }

    if (playerWon === true) {
        context.font = "3000px Garamond Pro";
        context.fillStyle = "green";
        canvas.style.letterSpacing = -30;
        context.textAlign = "center";
        context.fillText("YOU WON", 0, -5000);
    }

    if (playerWon || playerDead) {
        createButton(0, 200, 'PLAY AGAIN?', function () { window.location.reload(); });
    }
}