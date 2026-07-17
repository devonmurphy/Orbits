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
// mapRadius grew 15000->24000 (1.6x); zoom out enough to reveal the extra
// room without shrinking everything on screen by the full 1.6x.
var gameScale = .018;

var uiX = 20000;
var uiY = 19200;

// Resize canvas to window size. Setting canvas.width/height clears and
// reallocates the backing store, so this only needs to run on an actual
// resize event - not on every incoming gameState (up to ~60x/sec).
var resizeCanvas = function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    offsetLeft = canvas.offsetLeft + canvas.width / 2;
    offsetTop = canvas.offsetTop + canvas.height / 2;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

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
var botColor = "#ff9f1c";
var friendlyBotColor = "#4dffb8";

// Power-up rarity colors and name->rarity map. Keep in sync with the POWERS
// list in server/PowerUp.js.
var rarityColors = {
    common: "#ffffff",
    uncommon: "#4a90ff",
    rare: "#a259ff",
    legendary: "#ffd700",
};
var powerUpRarity = {
    'thrust': 'common',
    'fuel cell': 'common',
    'fire rate': 'uncommon',
    'max shooting power': 'uncommon',
    'bullet health': 'uncommon',
    'bullet radius': 'uncommon',
    'bullet count': 'uncommon',
    'fuel': 'uncommon',
    'shield': 'rare',
    'sidewinder': 'rare',
    'extra life': 'rare',
    'explosive ammo': 'legendary',
    'homing bullets': 'legendary',
    'chain lightning': 'legendary',
    'reanimate': 'legendary',
    'teleport': 'legendary',
    'black hole': 'legendary',
    'freeze time': 'legendary',
    'big bomb': 'legendary',
    'holy bubble': 'legendary',
};

// HUD colors
var hudLabelColor = "#7d8fb3";
var hudValueColor = "#ffffff";
var hudCautionColor = "#ffc24b";
var hudDangerColor = "#ff4d4d";
var hudFont = "480px Verdana";

// Approximate maximums used only to color-code resources as they run low -
// doesn't need to track powerup-boosted caps exactly to be a useful cue.
var FUEL_COLOR_MAX_HINT = 20000;
var BULLET_COLOR_MAX_HINT = 500;

var playerDead = false;
var playerWon = false;

var DEBUG_LINE = false;
var DEBUG_MAP = false;
var DEBUG_FPS = false;

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

var createLogin = function (data) {
    console.log('received login')

    var onSubmit = () => {
        var inGameName = document.getElementById("inGameName").value;
        socket.emit('login', inGameName);
    }

    ReactDOM.render(
        <Login
            onSubmit={onSubmit}
            error={data.error ? data.error : ''}
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

        /*
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
        */

        if (socket.id === id) {
            if (player.thrusting) {
                renderImage(player.x, -player.y, player.rotation * 180 / Math.PI, 600 / 350 * gameScale, 'shipThrusting');
            } else {
                renderImage(player.x, -player.y, player.rotation * 180 / Math.PI, 600 / 350 * gameScale, 'ship');
            }
        } else {
            if (player.thrusting) {
                renderImage(player.x, -player.y, player.rotation * 180 / Math.PI, 600 / 350 * gameScale, 'enemyShipThrusting');
            } else {
                renderImage(player.x, -player.y, player.rotation * 180 / Math.PI, 600 / 350 * gameScale, 'enemyShip');
            }
        }
    }
}

var drawPowerUp = function (powerUp) {
    var color = rarityColors[powerUp.rarity] || rarityColors.common;
    context.fillStyle = color;
    context.beginPath();
    context.arc(powerUp.x, -powerUp.y, powerUp.radius, 0, 2 * Math.PI);
    context.fill();

    // Rare/legendary drops get a glowing outline so they stand out at a glance
    if (powerUp.rarity === 'rare' || powerUp.rarity === 'legendary') {
        context.strokeStyle = color;
        context.lineWidth = orbitLineWidth;
        context.beginPath();
        context.arc(powerUp.x, -powerUp.y, powerUp.radius * 1.6, 0, 2 * Math.PI);
        context.stroke();
    }
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

var drawBot = function (bot) {
    var color = bot.friendly ? friendlyBotColor : botColor;
    context.fillStyle = color;
    context.beginPath();
    context.arc(bot.x, -bot.y, bot.radius, 0, 2 * Math.PI);
    context.fill();

    // Heading indicator so you can see what it's aiming at
    if (bot.clientX !== undefined && bot.clientY !== undefined) {
        var dx = bot.clientX - bot.x;
        var dy = bot.clientY - bot.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var noseLength = bot.radius * 1.8;
        var noseX = bot.x + dx / dist * noseLength;
        var noseY = -(bot.y + dy / dist * noseLength);
        context.strokeStyle = color;
        context.lineWidth = orbitLineWidth;
        context.beginPath();
        context.moveTo(bot.x, -bot.y);
        context.lineTo(noseX, noseY);
        context.stroke();
    }
}

var drawBlackHole = function (blackHole) {
    context.fillStyle = "#000000";
    context.beginPath();
    context.arc(blackHole.x, -blackHole.y, blackHole.radius, 0, 2 * Math.PI);
    context.fill();

    context.strokeStyle = rarityColors.legendary;
    context.lineWidth = orbitLineWidth;
    context.beginPath();
    context.arc(blackHole.x, -blackHole.y, blackHole.radius * 1.15, 0, 2 * Math.PI);
    context.stroke();
}

var drawLightningEffect = function (lightningEffect) {
    if (!lightningEffect || !lightningEffect.points || lightningEffect.points.length < 2) {
        return;
    }
    context.strokeStyle = rarityColors.legendary;
    context.lineWidth = orbitLineWidth;
    context.beginPath();
    context.moveTo(lightningEffect.points[0].x, -lightningEffect.points[0].y);
    for (var i = 1; i < lightningEffect.points.length; i++) {
        context.lineTo(lightningEffect.points[i].x, -lightningEffect.points[i].y);
    }
    context.stroke();
}

var drawBombEffect = function (bombEffect) {
    if (!bombEffect) {
        return;
    }
    context.strokeStyle = rarityColors.legendary;
    context.lineWidth = orbitLineWidth * 2;
    context.beginPath();
    context.arc(bombEffect.x, -bombEffect.y, bombEffect.radius, 0, 2 * Math.PI);
    context.stroke();
}

var drawHolyBubble = function (localPlayer, map) {
    context.strokeStyle = rarityColors.legendary;
    context.lineWidth = orbitLineWidth;

    if (map) {
        context.beginPath();
        context.arc(0, 0, planetRadius * 1.6, 0, 2 * Math.PI);
        context.stroke();
    }

    if (localPlayer) {
        context.beginPath();
        context.arc(localPlayer.x, -localPlayer.y, localPlayer.radius * 1.8, 0, 2 * Math.PI);
        context.stroke();
    }
}

var drawObjects = function (objects) {
    for (var uid in objects) {
        var object = objects[uid];
        if (object.type === 'asteroid') {
            drawAsteroid(object);
        } else if (object.type === 'powerUp') {
            drawPowerUp(object);
        } else if (object.type === 'bot') {
            drawBot(object);
        } else if (object.type === 'bullet') {
            drawBullet(object);
        } else if (object.type === 'blackHole') {
            drawBlackHole(object);
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

// Draws "label:  value" right-aligned at a fixed right edge (anchorX), with
// the value's right edge pinned there. This is what stops the line from
// visibly jiggling side to side whenever the value's digit count changes -
// the old version used textAlign "center" on the whole string, so e.g.
// "score: 9" -> "score: 10" re-centered the entire line around its anchor.
var drawHudStat = function (label, value, anchorX, y, valueColor) {
    context.font = hudFont;
    context.textAlign = "right";

    context.fillStyle = valueColor || hudValueColor;
    var valueText = String(value);
    context.fillText(valueText, anchorX, y);
    var valueWidth = context.measureText(valueText).width;

    context.fillStyle = hudLabelColor;
    context.fillText(label + "  ", anchorX - valueWidth, y);
}

// White -> caution -> danger as a ratio climbs toward 1 (e.g. strikes taken)
var hudRisingDangerColor = function (ratio) {
    if (ratio >= 0.66) return hudDangerColor;
    if (ratio >= 0.33) return hudCautionColor;
    return hudValueColor;
}

// White -> caution -> danger as a ratio falls toward 0 (e.g. fuel remaining)
var hudFallingDangerColor = function (ratio) {
    if (ratio <= 0.15) return hudDangerColor;
    if (ratio <= 0.4) return hudCautionColor;
    return hudValueColor;
}

var ABILITY_HUD_INFO = [
    { key: 'teleport', label: 'Teleport', keyNum: '1', powerName: 'teleport' },
    { key: 'blackHole', label: 'Black Hole', keyNum: '2', powerName: 'black hole' },
    { key: 'freezeTime', label: 'Freeze Time', keyNum: '3', powerName: 'freeze time' },
    { key: 'bigBomb', label: 'Big Bomb', keyNum: '4', powerName: 'big bomb' },
    { key: 'holyBubble', label: 'Holy Bubble', keyNum: '5', powerName: 'holy bubble' },
];

var drawGameUI = function (localPlayer, strikes, maxStrikes, map) {
    var hudRightEdge = uiX - 50;
    var hudRowHeight = 700;

    // Bottom-right stat block: score, bullets, fuel, strikes
    var row = uiY - 600;
    drawHudStat("score", localPlayer.score, hudRightEdge, row);
    row += hudRowHeight;

    if (localPlayer.bulletCount !== null) {
        var bulletColor = hudFallingDangerColor(localPlayer.bulletCount / BULLET_COLOR_MAX_HINT);
        drawHudStat("bullets", localPlayer.bulletCount, hudRightEdge, row, bulletColor);
        row += hudRowHeight;
    }

    if (localPlayer.fuel !== null) {
        var fuelColor = hudFallingDangerColor(localPlayer.fuel / FUEL_COLOR_MAX_HINT);
        drawHudStat("fuel", localPlayer.fuel, hudRightEdge, row, fuelColor);
        row += hudRowHeight;
    }

    if (strikes !== null) {
        var strikeColor = hudRisingDangerColor(strikes / maxStrikes);
        drawHudStat("strikes", strikes + "/" + maxStrikes, hudRightEdge, row, strikeColor);
    }

    // Top-right block: level and per-map kill progress
    var topRow = -uiY - 600;
    if (map.level !== null) {
        drawHudStat("level", map.level, hudRightEdge, topRow);
        topRow += hudRowHeight;
    }
    if (map.mapKills !== null) {
        drawHudStat("enemies destroyed", map.currentMapKills + " / " + map.mapKills, hudRightEdge, topRow);
    }

    if (map.mapKills !== null && map.currentMapKills >= map.mapKills) {
        context.font = hudFont;
        context.fillStyle = hudValueColor;
        context.textAlign = "center";
        context.fillText("Escape planet gravity", 0, -uiY - 5000);
        context.fillText("to proceed to next map", 0, -uiY - 4350);
        outOfBoundsColor = "#00002f";
    } else {
        outOfBoundsColor = "#000011";
    }

    // Top-left: unlocked ability cooldowns
    if (localPlayer.abilityCooldowns) {
        context.font = hudFont;
        context.textAlign = "left";
        var abilityRow = -uiY - 600;
        for (var a = 0; a < ABILITY_HUD_INFO.length; a++) {
            var info = ABILITY_HUD_INFO[a];
            if (!(localPlayer.powerUps && localPlayer.powerUps[info.powerName] > 0)) {
                continue;
            }
            var readyAt = localPlayer.abilityCooldowns[info.key] || 0;
            var remaining = (readyAt - Date.now()) / 1000;
            var status = remaining > 0 ? remaining.toFixed(1) + "s" : "READY";
            context.fillStyle = remaining > 0 ? hudLabelColor : rarityColors.legendary;
            context.fillText("[" + info.keyNum + "] " + info.label + ": " + status, -uiX, abilityRow);
            abilityRow += hudRowHeight;
        }
    }

    // Bottom-left: active powerups
    if (localPlayer.powerUps !== null) {
        context.font = hudFont;
        context.textAlign = "left";
        var powerUpNames = Object.keys(localPlayer.powerUps);
        for (let i = 0; i < powerUpNames.length; i++) {
            var name = powerUpNames[i];
            var rarity = powerUpRarity[name] || 'common';
            context.fillStyle = rarityColors[rarity];
            context.fillText(localPlayer.powerUps[name] + "x  " + name, -uiX, uiY + 600 + hudRowHeight * i);
        }
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
    var map = gameState.map;

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
    drawPlanet();
    drawShootingOrbit(shootingOrbits);

    drawObjects(objects);
    drawPlayers(players);
    drawLightningEffect(gameState.lightningEffect);
    drawBombEffect(gameState.bombEffect);

    if (gameState.holyBubbleActive) {
        drawHolyBubble(localPlayer, map);
    }

    if (gameState.timeFrozen && map) {
        context.fillStyle = "rgba(74, 144, 255, 0.15)";
        context.beginPath();
        context.arc(0, 0, map.mapRadius, 0, 2 * Math.PI);
        context.fill();
    }

    if (DEBUG_FPS) {
        drawFPSCounter();
    }

    if (localPlayer) {
        drawGameUI(localPlayer, strikes, maxStrikes, map);
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