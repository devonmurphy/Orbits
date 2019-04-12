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
var playerRadius = 250;
var bulletRadius = 125;
var gameScale = .04;

// Colors
var backgroundColor = "#000066";
var earthColor = "#a6ff99";

var playerColor = "#00ccff";
var orbitLineColor = "#a329e0";
var playerBulletColor = "#00ccff";

var enemyColor = "#ff0066";
var enemyOrbitLineColor = "#ffcc00";
var enemyBulletColor = "#ff0066";

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
    };
    socket.emit('mousedown', data);
});

canvas.addEventListener("mouseup", function (event) {
    var data = {
        clientX: (event.clientX - offsetLeft) / gameScale,
        clientY: (event.clientY - offsetTop) / gameScale,
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

/**
 * Disables the right click menu for the given element.
 */
function disableRightClickContextMenu(element) {
    element.addEventListener('contextmenu', function (e) {
        if (e.button == 2) {
            // Block right-click menu thru preventing default action.
            e.preventDefault();
        }
    });
}

disableRightClickContextMenu(canvas);

// On connection notify the server of a new player
socket.emit('new player');

// Receive game state from server and then render it
socket.on('gameState', function (gameState) {
    render(gameState);
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
        } else {
            context.strokeStyle = enemyOrbitLineColor;
        }
        // Draw orbits

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

        // Draw players
        var player = players[id].player;
        if (socket.id === id) {
            context.fillStyle = playerColor;
        } else {
            context.fillStyle = enemyColor;
        }
        context.beginPath();
        context.arc(player.x, -player.y, playerRadius, 0, 2 * Math.PI);
        context.fill();
    }
}

var drawBullets = function (bullets) {
    for (var i = 0; i < bullets.length; i++) {
        console.log(bullets[i]);
        if (socket.id === bullets[i].id) {
            context.fillStyle = playerBulletColor;
        } else {
            context.fillStyle = enemyBulletColor;
        }
        context.beginPath();
        context.arc(bullets[i].x, -bullets[i].y, bulletRadius, 0, 2 * Math.PI);
        context.fill();
    }

}

var drawShootingOrbits = function (shootingOrbits) {
    // Draw orbits
    if(!shootingOrbits[socket.id]){
        return
    }
    var ellipse = shootingOrbits[socket.id].ellipse;
    var points = shootingOrbits[socket.id].points;

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

//  Render based on game state received from server
var render = function (gameState) {
    var players = gameState.players;
    var bullets = gameState.bullets;
    var shootingOrbits = gameState.shootingOrbits;
    // Reset canvas and draw background
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = backgroundColor;
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.fill();

    // Move canvas origin to center and zoom out
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(gameScale, gameScale);

    // Draw everthing
    drawPlayers(players);
    drawBullets(bullets);
    drawEarth();
    drawShootingOrbits(shootingOrbits);
}
