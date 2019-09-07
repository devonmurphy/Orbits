import React from "react";
import ReactDOM from "react-dom";
import GameSelectBtns from "../react/GameSelectBtns.js";
import PlayAgainBtn from "../react/PlayAgainBtn.js";
import CreateGameUI from "../react/CreateGameUI.js";
import WaitingForGame from "../react/WaitingForGame.js";
import Login from "../react/Login.js";
import socket from "./Socket.js"

var canvas = document.getElementById('renderer');
var context = canvas.getContext("2d");

// Offsets
var offsetLeft = canvas.offsetLeft + canvas.width / 2;
var offsetTop = canvas.offsetTop + canvas.height / 2;

// Scale and size
var orbitLineWidth = "50";
var planetRadius = 1500;
var gameScale = .025;

var uiX = 12500;
var uiY = 12000;

// Resize canvas to window size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight

// Colors
var outOfBoundsColor = "#000011";
var gameBackgroundColor = "#000022";
var planetColor = "#a6ff99";

var playerColor = "#1f9fef";
var orbitLineColor = "#a329e0";
var playerShootingLineColor = "#1f9fef";
var playerBulletColor = "#ebc934";

var enemyColor = "#ff0066";
var enemyBulletColor = "#ff0066";

var playerDead = false;
var playerWon = false;

var DEBUG_LINE = false;
var DEBUG_MAP = false;
var DEBUG_FPS = true;

var setPlayerWon = function () {
    playerWon = true;
}

var setPlayerDead = function () {
    playerDead = true;
}

var renderImage = function (x, y, angle, scale, source) {
    const image = document.getElementById(source);
    context.translate(x, y);
    context.scale(1 / gameScale * scale, 1 / gameScale * scale);
    context.rotate(angle * Math.PI / 180);
    context.drawImage(image, - image.width / 2, - image.height / 2);
    context.rotate(-angle * Math.PI / 180);
    context.scale(gameScale / scale, gameScale / scale);
    context.translate(-x, -y);
}

var lastFpsTime = 0;
var fpsCount = 0;
var fps = 0;
var fpsUpdateRate = 5;
var drawFPSCounter = function () {
    if (fpsCount % fpsUpdateRate === 0) {
        var newTime = performance.now();
        var delta = newTime - lastFpsTime;
        lastFpsTime = newTime;
        fps = Math.round(1 / delta * 1000 * fpsUpdateRate);
    }
    fpsCount += 1;

    context.font = "600px Verdana";
    context.fillStyle = "white";
    context.textAlign = "center";
    context.fillText("fps: " + fps, uiX - 850, uiY - 1200);
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

    var createGameOnClick = () => {
        createGame();
    }

    var joinGameOnClick = () => {
        socket.emit('Join Game');
        waitingForGame();
    }

    ReactDOM.render(
        <GameSelectBtns
            quickMatchOnClick={quickMatchOnClick}
            singlePlayerOnClick={singlePlayerOnClick}
            createGameOnClick={createGameOnClick}
        />,
        document.getElementById('root')
    );
}

var createLogin = function () {

    var onSubmit = () => {
        var inGameName = document.getElementById("inGameName").value;
        socket.emit('login', inGameName);
    }

    ReactDOM.render(
        <Login
            onSubmit={onSubmit}
        />,
        document.getElementById('root')
    );
}

var waitingForGame = function (data) {
    // Remove Game select btns and display canvas;
    ReactDOM.unmountComponentAtNode(document.getElementById('root'));

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

    if (data) {
        var currentPlayers = data.currentPlayers;
        var maxPlayers = data.maxPlayers;
        var gameLink = data.gameLink;
        if (currentPlayers === maxPlayers) {
            document.getElementById('renderer').style.display = 'block';
        } else {
            ReactDOM.render(
                <WaitingForGame
                    currentPlayers={currentPlayers}
                    maxPlayers={maxPlayers}
                    gameLink={gameLink}
                />,
                document.getElementById('root')
            );
        }
    } else {
        document.getElementById('renderer').style.display = 'block';
        context.fillText("WAITING FOR OPPONENT...", 0, -5000);
    }
}

var createGame = function () {
    // Remove Game select btns and display canvas;
    ReactDOM.unmountComponentAtNode(document.getElementById('root'));

    var onSubmit = function () {
        var playerCount = document.getElementById("playerCount").value;
        socket.emit('Create Game', playerCount);
    };

    ReactDOM.render(
        <CreateGameUI
            onSubmit={onSubmit}
        />,
        document.getElementById('root')
    );
}

var drawPlanet = function () {
    // Draw Planet
    context.fillStyle = planetColor;
    context.beginPath();
    context.arc(0, 0, planetRadius, 0, 2 * Math.PI);
    context.fill();
}

var drawPlayers = function (players) {
    for (var id in players) {
        if (socket.id === id) {
            if (players[id]) {
                drawOrbit(players[id].orbitParams, orbitLineColor)
            }
        }

        // Draw player
        var player = players[id];
        var name = players[id].name;

        // Draw Player name
        context.font = "600px Verdana";
        context.fillStyle = "white";
        context.textAlign = "center";
        context.fillText(name, player.x, -player.y - 600);

        context.strokeStyle = "black";
        context.lineWidth = 2 * orbitLineWidth;

        if (socket.id === id) {
            context.fillStyle = playerColor;
        } else {
            context.fillStyle = enemyColor;
        }
        context.beginPath();
        context.arc(player.x, -player.y, player.radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();

        renderImage(player.x, -player.y, 45, .04, 'ship');
    }
}

var drawPowerUp = function (powerUp) {
    context.fillStyle = "white";
    context.beginPath();
    context.arc(powerUp.x, -powerUp.y, powerUp.radius, 0, 2 * Math.PI);
    context.fill();

}

var drawAsteroid = function (asteroid) {
    context.fillStyle = enemyBulletColor;
    context.beginPath();
    context.arc(asteroid.x, -asteroid.y, asteroid.radius, 0, 2 * Math.PI);
    context.fill();
}

var drawBullet = function (bullet) {
    if (socket.id === bullet.id) {
        context.fillStyle = playerBulletColor;
    } else {
        context.fillStyle = enemyBulletColor;
    }
    context.beginPath();
    context.arc(bullet.x, -bullet.y, bullet.radius, 0, 2 * Math.PI);
    context.fill();
}

var drawObjects = function (objects) {
    for (var uid in objects) {
        var object = objects[uid];
        if (object.type === 'asteroid') {
            drawAsteroid(object);
        } else if (object.type === 'powerUp') {
            drawPowerUp(object);
        } else if (object.type === 'bullet') {
            drawBullet(object);
        }
    }
}

var drawOrbit = function (orbitParams, lineColor) {
    var ellipse = orbitParams.ellipse;
    var points = orbitParams.points;

    // Draw Elliptical orbit
    if (ellipse) {
        context.beginPath();
        context.strokeStyle = lineColor;
        context.lineWidth = orbitLineWidth;
        context.ellipse(ellipse.x, ellipse.y, ellipse.a, ellipse.b, ellipse.w, 0, 2 * Math.PI);
        context.stroke();
    }

    // Draw Hyperbolic orbit
    if (points) {
        if (!DEBUG_LINE) {
            context.beginPath();
            context.strokeStyle = lineColor;
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

var drawShootingOrbit = function (shootingOrbits) {
    // Draw orbits
    if (!shootingOrbits[socket.id]) {
        return
    }
    drawOrbit(shootingOrbits[socket.id], playerShootingLineColor)
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
        context.fillText("strikes: " + strikes + "/" + maxStrikes, uiX - 720, uiY + 1150);
    }

    context.font = "600px Verdana";
    context.fillStyle = "white";
    context.textAlign = "center";

    if (localPlayer.fuel !== null) {
        context.fillText("fuel: " + localPlayer.fuel, uiX - 50, uiY + 600);
    }
}

//  Render based on game state received from server
var render = function (gameState) {
    var players = gameState.players;
    var objects = gameState.objects;
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
    drawObjects(objects);
    drawPlanet();
    drawShootingOrbit(shootingOrbits);

    drawPlayers(players);
    if (DEBUG_FPS) {
        drawFPSCounter();
    }

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

        ReactDOM.render(
            <PlayAgainBtn />,
            document.getElementById('playAgain')
        );
    }
}

export { render, createLogin, createGameSelectBtns, waitingForGame, gameScale, offsetLeft, offsetTop, setPlayerDead, setPlayerWon };