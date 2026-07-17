// Named uidSafe (not uid) since this file uses `var uid` extensively as a
// for..in loop variable, which would otherwise shadow this import within
// any function using that pattern (var hoisting is function-scoped).
var uidSafe = require('uid-safe');
var Mass = require('./Mass.js');
var Player = require('./Player.js');
var Bullet = require('./Bullet.js');
var Asteroid = require('./Asteroid.js');
var PowerUp = require('./PowerUp.js');
var Bot = require('./Bot.js');
var Planet = require('./Planet.js');
var CollisionSystem = require('./CollisionSystem.js');
var utils = require('./utils.js');

var DEBUG_LAG = 0;

// Simulation runs every 15ms (~66Hz) for responsive controls, but the full
// gameState (including per-player orbit trajectories) is only broadcast
// every Nth tick to cut socket bandwidth roughly in half.
var BROADCAST_EVERY_N_TICKS = 2;

// Bullets on a bound orbit never leave map bounds on their own, so cap their
// lifetime to stop them from accumulating (and dragging down collision/
// broadcast cost) over a long session.
var BULLET_LIFETIME_MS = 8000;

// How far explosive ammo's splash damage reaches from the impact point
var EXPLOSIVE_RADIUS = 900;

// How strongly homing bullets steer toward the nearest hostile target
var HOMING_STRENGTH = 300;

// How many hops chain lightning jumps through, and how far each hop can reach
var CHAIN_LIGHTNING_MAX_JUMPS = 3;
var CHAIN_LIGHTNING_JUMP_RANGE = 3500;

// Key-triggered, cooldown-gated abilities. powerName is the power-up that
// must be owned (player.powerUps[powerName] > 0) for the key press to do
// anything; cooldownMs gates how often it can be re-triggered once unlocked.
var ABILITY_CONFIG = {
    teleport: { powerName: 'teleport', cooldownMs: 8000 },
    blackHole: { powerName: 'black hole', cooldownMs: 15000 },
    freezeTime: { powerName: 'freeze time', cooldownMs: 20000 },
    bigBomb: { powerName: 'big bomb', cooldownMs: 12000 },
    holyBubble: { powerName: 'holy bubble', cooldownMs: 25000 },
};
var FREEZE_TIME_DURATION_MS = 3000;
var BLACK_HOLE_DURATION_MS = 6000;
var BLACK_HOLE_MASS = 8000000000;
var BLACK_HOLE_RADIUS = 500;
var BOMB_RADIUS = 2500;
var HOLY_BUBBLE_DURATION_MS = 5000;

// Reanimate: not a key-triggered ability - it auto-procs whenever you land
// the killing blow on a bot, subject to its own cooldown (reusing the same
// abilityCooldowns bag the key-triggered abilities use).
var REANIMATE_COOLDOWN_MS = 30000;
var REANIMATED_BOT_HEALTH = 2;

class Game {
    constructor(opts) {
        // Server side constants
        this.io = opts.io;
        this.gameId = opts.gameId;
        this.playerCount = opts.playerCount;
        this.gameEnded = opts.gameEnded;
        this.type = opts.type;
        this.autoStart = opts.autoStart;

        // Containers used for game state
        this.players = {};
        this.playerSockets = [];
        this.shootingOrbits = {};
        this.objects = {};

        // Game constants
        this.planetRadius = 1500;
        this.mass = 5000000000;
        this.planet = new Planet(0, 0, this.planetRadius, this.mass);

        // Starting distance to spawn players
        this.startingDist = 13000;

        // Map constants
        this.gridCount = 3;
        this.gridSize = 10000;
        this.mapRadius = 24000;
        this.mapEnded = false;
        this.level = (this.type === 'single player' ? 1 : null);
        this.currentMapKills = (this.type === 'single player' ? 0 : null);
        this.mapKills = (this.type === 'single player' ? 5 : null);

        // Single Player constats
        this.asteroidRadius = 350;
        this.asteroidSpawnRate = (this.type === 'single player' ? 5000 : Infinity);
        this.lastAsteroidSpawnTime = (new Date()).getTime();

        this.powerUpRadius = 350;
        this.powerUpSpawnRate = (this.type === 'single player' ? 5000 : Infinity);
        this.lastPowerUpSpawnTime = (new Date()).getTime();

        this.strikes = (this.type === 'single player' ? 0 : null);
        this.maxStrikes = (this.type === 'single player' ? 3 : null);

        // Bot enemies (single player only) - AI ships that hunt the player
        this.maxBots = (this.type === 'single player' ? Math.min(this.level, 3) : 0);
        this.botSpawnRate = (this.type === 'single player' ? 12000 : Infinity);
        this.lastBotSpawnTime = (new Date()).getTime();

        this.map = new CollisionSystem(this.mapRadius);

        this.tickCount = 0;
    }

    loadNewMap() {
        this.level += 1;
        this.shootingOrbits = {};
        this.objects = {};
        this.currentMapKills = (this.type === 'single player' ? 0 : null);
        this.strikes = (this.type === 'single player' ? 0 : null);
        this.maxStrikes = (this.type === 'single player' ? 3 : null);
        this.mapKills = (this.type === 'single player' ? 5 * this.level : null);

        let asteroidSpawnRate = 5000 - this.level * 500;
        let powerUpSpawnRate = 5000 - this.level * 250;
        if (asteroidSpawnRate < 0) { asteroidSpawnRate = 500; }
        if (powerUpSpawnRate < 0) { powerUpSpawnRate = 250; }
        this.asteroidSpawnRate = (this.type === 'single player' ? asteroidSpawnRate : Infinity);
        this.lastAsteroidSpawnTime = (new Date()).getTime();
        this.powerUpSpawnRate = (this.type === 'single player' ? powerUpSpawnRate : Infinity);
        this.lastPowerUpSpawnTime = (new Date()).getTime();

        this.maxBots = (this.type === 'single player' ? Math.min(this.level, 3) : 0);
        this.lastBotSpawnTime = (new Date()).getTime();

        Object.keys(this.players).forEach((key) => {
            this.respawnPlayer(key)
        });
        this.mapEnded = false;
    }

    buildGameState() {
        var map = {
            mapRadius: this.mapRadius,
            mapKills: this.mapKills,
            currentMapKills: this.currentMapKills,
            level: this.level
        };
        var currentTime = Date.now();
        return {
            players: this.players,
            objects: this.objects,
            shootingOrbits: this.shootingOrbits,
            map,
            strikes: this.strikes,
            maxStrikes: this.maxStrikes,
            lightningEffect: (this.lightningEffect && currentTime < this.lightningEffect.expiresAt) ? this.lightningEffect : null,
            timeFrozen: !!(this.timeFreezeUntil && currentTime < this.timeFreezeUntil),
            bombEffect: (this.bombEffect && currentTime < this.bombEffect.expiresAt) ? this.bombEffect : null,
            holyBubbleActive: !!(this.holyBubbleUntil && currentTime < this.holyBubbleUntil),
        };
    }

    broadcastGameState() {
        var gameState = this.buildGameState();
        if (DEBUG_LAG === 0) {
            this.io.sockets.in(this.gameId).emit('gameState', gameState);
        } else {
            // Send the game state to the clients to be rendered
            setTimeout(() => {
                this.io.sockets.in(this.gameId).emit('gameState', gameState);
            }, DEBUG_LAG);
        }
    }

    // Update the game state every 15 ms
    start() {
        this.io.sockets.in(this.gameId).emit('starting game');
        this.gameLoop = setInterval(() => {
            try {
                this.checkIfMapEnds();
                if (!this.mapEnded) {
                    this.checkIfAsteroidSpawns();
                    this.checkIfPowerUpSpawns();
                    this.checkIfBotSpawns();
                }
                this.updateObjects();
                this.updatePlayers();
                this.handleCollisions();

                this.tickCount += 1;
                if (this.tickCount % BROADCAST_EVERY_N_TICKS !== 0) {
                    return;
                }

                this.broadcastGameState();
            } catch (err) {
                // A tick throwing used to silently stop the whole game loop
                // (setInterval doesn't retry after an uncaught error) with
                // nothing logged - log it so failures are visible instead of
                // presenting as an unexplained freeze.
                console.error('Game loop error for game', this.gameId, err);
            }
        }, 15)
    }

    checkIfPowerUpSpawns() {
        var currentTime = (new Date()).getTime();
        if (currentTime - this.lastPowerUpSpawnTime >= this.powerUpSpawnRate) {


            var startingDist = Math.random() * 16000 + 32000;
            var XYRatio = Math.random();
            var startingDistX = (Math.random() > .5 ? -1 : 1) * startingDist * (XYRatio);
            var startingDistY = (Math.random() > .5 ? -1 : 1) * startingDist * (Math.sqrt(1 - XYRatio * XYRatio));

            var powerUp = new PowerUp(startingDistX, startingDistY, this.powerUpRadius);
            // Roll the power (and its rarity) now, not lazily on pickup, so
            // the rarity color is visible on the map before it's collected.
            powerUp.generateRandomPower();

            var dist = Math.sqrt(Math.pow(powerUp.x, 2) + Math.pow(powerUp.y, 2));
            var speedSpreadX = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            var speedSpreadY = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            powerUp.vx = -powerUp.x / dist * 500 + speedSpreadX;
            powerUp.vy = -powerUp.y / dist * 500 + speedSpreadY;

            this.objects[powerUp.uid] = utils.deepCopy(powerUp);
            this.lastPowerUpSpawnTime = (new Date()).getTime();
        }

    }

    checkIfAsteroidSpawns() {
        var currentTime = (new Date()).getTime();
        if (currentTime - this.lastAsteroidSpawnTime >= this.asteroidSpawnRate) {


            var startingDist = Math.random() * 16000 + 32000;
            var XYRatio = Math.random();
            var startingDistX = (Math.random() > .5 ? -1 : 1) * startingDist * (XYRatio);
            var startingDistY = (Math.random() > .5 ? -1 : 1) * startingDist * (Math.sqrt(1 - XYRatio * XYRatio));

            var asteroidHP = Math.floor(Math.random() * this.level) + 1;
            var asteroid = new Asteroid(startingDistX, startingDistY, this.asteroidRadius, this.gameId, asteroidHP);

            var dist = Math.sqrt(Math.pow(asteroid.x, 2) + Math.pow(asteroid.y, 2));
            var speedSpreadX = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            var speedSpreadY = (Math.random() > .5 ? -1 : 1) * 500 * Math.random();
            asteroid.vx = -asteroid.x / dist * 500 + speedSpreadX;
            asteroid.vy = -asteroid.y / dist * 500 + speedSpreadY;

            this.objects[asteroid.uid] = utils.deepCopy(asteroid);
            this.lastAsteroidSpawnTime = (new Date()).getTime();
        }
    }

    checkIfBotSpawns() {
        var currentTime = (new Date()).getTime();
        // Reanimated (friendly) bots don't count against the hostile spawn
        // cap, so building up allies doesn't stall the difficulty ramp.
        var currentBotCount = Object.values(this.objects).filter((o) => o.type === 'bot' && !o.friendly).length;
        if (currentBotCount >= this.maxBots) {
            return;
        }
        if (currentTime - this.lastBotSpawnTime >= this.botSpawnRate) {

            var startingDist = Math.random() * 16000 + 32000;
            var XYRatio = Math.random();
            var startingDistX = (Math.random() > .5 ? -1 : 1) * startingDist * (XYRatio);
            var startingDistY = (Math.random() > .5 ? -1 : 1) * startingDist * (Math.sqrt(1 - XYRatio * XYRatio));

            var botHealth = 2 + Math.floor(this.level / 2);
            var bot = new Bot(startingDistX, startingDistY, this.gameId, botHealth);

            var dist = Math.sqrt(Math.pow(bot.x, 2) + Math.pow(bot.y, 2));
            bot.vx = -bot.y / dist * 400;
            bot.vy = bot.x / dist * 400;

            this.objects[bot.uid] = utils.deepCopy(bot);
            this.lastBotSpawnTime = currentTime;
        }
    }

    respawnPlayer(id) {
        // Spawn player in a circlular orbit based on which player they are in game
        var playerCount = this.playerCount;
        var playerNumber = Object.keys(this.players).length;
        var playerOffsetX = Math.cos(2 * Math.PI * playerNumber / playerCount);
        var playerOffsetY = Math.sin(2 * Math.PI * playerNumber / playerCount);

        this.players[id].x = this.startingDist * playerOffsetX;
        this.players[id].y = this.startingDist * playerOffsetY;

        // Calculate velocity for circular orbit
        var dist = Math.sqrt(Math.pow(this.players[id].x, 2) + Math.pow(this.players[id].y, 2));
        var circularOrbitVel = Math.sqrt(this.planet.mass / dist);

        // Here we took the derivitive of the offsets when they were multplied by the velocity
        this.players[id].vx = circularOrbitVel * playerOffsetY;
        this.players[id].vy = -circularOrbitVel * playerOffsetX;

        // Initial calculation of orbit parameters
        this.players[id].orbitParams = this.players[id].calculateOrbit(this.planet.mass);

    }
    // Create a new player
    spawnPlayer(socket, playerName) {
        // Spawn player in a circlular orbit based on which player they are in game
        var playerCount = this.playerCount;
        var playerNumber = Object.keys(this.players).length;
        var playerOffsetX = Math.cos(2 * Math.PI * playerNumber / playerCount);
        var playerOffsetY = Math.sin(2 * Math.PI * playerNumber / playerCount);

        this.players[socket.id] = new Player(this.startingDist * playerOffsetX, this.startingDist * playerOffsetY, playerName);
        this.players[socket.id].setupHandlers(socket);

        // Calculate velocity for circular orbit
        var dist = Math.sqrt(Math.pow(this.players[socket.id].x, 2) + Math.pow(this.players[socket.id].y, 2));
        var circularOrbitVel = Math.sqrt(this.planet.mass / dist);

        // Here we took the derivitive of the offsets when they were multplied by the velocity
        this.players[socket.id].vx = circularOrbitVel * playerOffsetY;
        this.players[socket.id].vy = -circularOrbitVel * playerOffsetX;

        // Initial calculation of orbit parameters
        this.players[socket.id].orbitParams = this.players[socket.id].calculateOrbit(this.planet.mass);
    }

    connectPlayer(player, socket) {
        socket.join(this.gameId);

        // Spawn the player on the map
        this.spawnPlayer(socket, player.name);

        // Automatically start the game if autoStart is true and the playerCount is reached
        if (this.autoStart && Object.keys(this.players).length === this.playerCount) {
            this.start();
        }
    }

    reconnectPlayer(socket, oldSocket, player) {
        socket.join(this.gameId);

        // Copy old player object and reset the player id
        if (oldSocket.id in this.players) {
            this.players[socket.id] = utils.deepCopy(this.players[oldSocket.id]);
            this.players[socket.id].id = socket.id;
            this.players[socket.id].setupHandlers(socket);
        } else {
            this.connectPlayer(player, socket);
            return;
        }

        // Update all of the old bullet ids to the new id
        for (var uid in this.objects) {
            if (this.objects[uid].id === oldSocket.id) {
                this.objects[uid].id = socket.id;
            }
        }

        // Delete the old player
        delete this.players[oldSocket.id];
    }

    checkIfMapEnds() {
        if (this.currentMapKills >= this.mapKills) {
            this.mapEnded = true;
        }
    }

    checkIfGameEnds() {
        if (Object.keys(this.players).length === 1 && this.type !== 'single player') {
            var lastId = Object.keys(this.players)[0];
            this.io.to(lastId).emit('youwon', 'You Won');
            this.endGame();
        }

        if (Object.keys(this.players).length === 0) {
            this.endGame();
        }

        // End the game if the strikes exceeded the max strikes
        if (this.strikes >= this.maxStrikes && this.type === 'single player') {
            this.io.sockets.in(this.gameId).emit('youdied', 'Your Planet Died');
            this.endGame();
        }
    }

    endGame() {
        // Always send one last authoritative snapshot so clients actually
        // render the terminal state (e.g. "YOU DIED"/"YOU WON") even if this
        // tick wasn't due for a periodic broadcast - render() only runs when
        // a gameState arrives, and clearInterval below means none ever will
        // again, so skipping this would leave clients frozen on stale state.
        this.broadcastGameState();

        // Game has ended clean up
        clearInterval(this.gameLoop);
        this.gameEnded(this.gameId)
    }

    killPlayer(io, id) {
        io.to(id).emit('youdied', 'You Died');
        delete this.players[id]

        this.checkIfGameEnds();
    }

    spawnBullet(player, angleOffset) {
        var bullet = new Bullet(player);
        bullet.calculateShootingOrbit(player.shotPower, player, this.planet.mass, angleOffset);
        this.objects[bullet.uid] = utils.deepCopy(bullet);
    }

    // Sidewinder fires extra angled bullets alongside the normal shot,
    // scaling with stacked pickups (capped so it doesn't get absurd).
    fireSidewinderVolley(player) {
        var level = Math.min(player.sidewinderLevel || 0, 3);
        for (var i = 1; i <= level; i++) {
            var angle = i * (12 * Math.PI / 180);
            this.spawnBullet(player, angle);
            this.spawnBullet(player, -angle);
        }
    }

    // Explosive ammo splash damage (and the big bomb ability, which is just
    // this with a bigger radius): anything hostile within range of the
    // impact point takes a hit, same as a direct shot would deal.
    explodeAt(x, y, shooterId, radius) {
        var blastRadius = radius || EXPLOSIVE_RADIUS;
        for (var uid in this.objects) {
            var obj = this.objects[uid];
            if (obj.type !== 'asteroid' && !(obj.type === 'bot' && !obj.friendly)) {
                continue;
            }
            var dx = obj.x - x;
            var dy = obj.y - y;
            if (Math.sqrt(dx * dx + dy * dy) > blastRadius) {
                continue;
            }
            if (obj.health <= 1) {
                if (shooterId in this.players) {
                    this.players[shooterId].score += 1;
                    this.currentMapKills += 1;
                }
                delete this.objects[uid];
            } else {
                obj.health -= 1;
                if (obj.type === 'asteroid') {
                    obj.updateRadius(this.asteroidRadius);
                }
            }
        }
    }

    // Chain lightning: hops from the bullet's impact point to nearby
    // hostiles, each hop dealing the same damage a direct hit would. The
    // object actually hit by the bullet is excluded (found via nearest-
    // match, since collision records don't carry the target's uid) so the
    // chain extends outward instead of re-hitting the same target.
    chainLightningFrom(bulletX, bulletY, shooterId) {
        var hitUids = {};

        var nearestUid = null;
        var nearestDist = Infinity;
        for (var uid in this.objects) {
            var obj = this.objects[uid];
            if (obj.type !== 'asteroid' && obj.type !== 'bot') {
                continue;
            }
            var dx = obj.x - bulletX;
            var dy = obj.y - bulletY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestUid = uid;
            }
        }
        if (nearestUid) {
            hitUids[nearestUid] = true;
        }

        var currentX = bulletX;
        var currentY = bulletY;
        var hitPoints = [{ x: bulletX, y: bulletY }];

        for (var jump = 0; jump < CHAIN_LIGHTNING_MAX_JUMPS; jump++) {
            var targetUid = null;
            var target = null;
            var targetDist = Infinity;
            for (var uid2 in this.objects) {
                var candidate = this.objects[uid2];
                if (candidate.type !== 'asteroid' && !(candidate.type === 'bot' && !candidate.friendly)) {
                    continue;
                }
                if (hitUids[uid2]) {
                    continue;
                }
                var cdx = candidate.x - currentX;
                var cdy = candidate.y - currentY;
                var cdist = Math.sqrt(cdx * cdx + cdy * cdy);
                if (cdist < CHAIN_LIGHTNING_JUMP_RANGE && cdist < targetDist) {
                    targetDist = cdist;
                    target = candidate;
                    targetUid = uid2;
                }
            }
            if (!target) {
                break;
            }

            hitUids[targetUid] = true;
            hitPoints.push({ x: target.x, y: target.y });

            if (target.health <= 1) {
                if (shooterId in this.players) {
                    this.players[shooterId].score += 1;
                    this.currentMapKills += 1;
                }
                delete this.objects[targetUid];
            } else {
                target.health -= 1;
                if (target.type === 'asteroid') {
                    target.updateRadius(this.asteroidRadius);
                }
            }

            currentX = target.x;
            currentY = target.y;
        }

        if (hitPoints.length > 1) {
            this.lightningEffect = { points: hitPoints, expiresAt: Date.now() + 250 };
        }
    }

    // Dispatches a number-key ability press, gated by unlock status (must
    // own the matching power-up) and its own cooldown.
    tryActivateAbility(player, id, ability) {
        var config = ABILITY_CONFIG[ability];
        if (!config) {
            return;
        }
        if (!(player.powerUps[config.powerName] > 0)) {
            return;
        }

        var currentTime = Date.now();
        var readyAt = player.abilityCooldowns[ability] || 0;
        if (currentTime < readyAt) {
            return;
        }
        player.abilityCooldowns[ability] = currentTime + config.cooldownMs;

        if (ability === 'teleport') {
            this.activateTeleport(player);
        } else if (ability === 'blackHole') {
            this.activateBlackHole(player);
        } else if (ability === 'freezeTime') {
            this.activateFreezeTime(id);
        } else if (ability === 'bigBomb') {
            this.activateBigBomb(player, id);
        } else if (ability === 'holyBubble') {
            this.activateHolyBubble();
        }
    }

    // Teleports the player to their current aim point, clamped just inside
    // the map boundary so it can't be used to instantly self-kill via
    // out-of-bounds.
    activateTeleport(player) {
        if (player.clientX === undefined || player.clientY === undefined) {
            return;
        }
        var destX = player.clientX;
        var destY = player.clientY;
        var dist = Math.sqrt(destX * destX + destY * destY);
        var maxDist = this.mapRadius - player.radius - 500;
        if (dist > maxDist && dist > 0) {
            destX = destX / dist * maxDist;
            destY = destY / dist * maxDist;
        }
        player.x = destX;
        player.y = destY;
        player.orbitParams = player.calculateOrbit(this.planet.mass);
    }

    // Spawns a temporary gravity well at the player's aim point. It pulls in
    // (and, at close range, destroys) nearby asteroids/bots, but doesn't
    // affect the player who cast it.
    activateBlackHole(player) {
        if (player.clientX === undefined || player.clientY === undefined) {
            return;
        }
        var blackHole = {
            uid: uidSafe.sync(8),
            type: 'blackHole',
            x: player.clientX,
            y: player.clientY,
            vx: 0,
            vy: 0,
            radius: BLACK_HOLE_RADIUS,
            mass: BLACK_HOLE_MASS,
            expiresAt: Date.now() + BLACK_HOLE_DURATION_MS,
        };
        this.objects[blackHole.uid] = blackHole;
    }

    // Applies this tick's pull from a black hole to obj. Returns true if obj
    // strayed inside the event horizon and should be destroyed.
    applyBlackHoleForce(blackHole, obj) {
        var dx = obj.x - blackHole.x;
        var dy = obj.y - blackHole.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < blackHole.radius * 0.3) {
            return true;
        }
        var forceMag = blackHole.mass / (dist * dist);
        obj.addForce({ x: -dx / dist * forceMag, y: -dy / dist * forceMag });
        return false;
    }

    // Stops all hostile activity (asteroids, bots, their bullets) for a few
    // seconds. The caster's own bullets keep flying so they can still land
    // hits on the frozen targets.
    activateFreezeTime(casterId) {
        this.timeFreezeUntil = Date.now() + FREEZE_TIME_DURATION_MS;
        this.timeFreezeCasterId = casterId;
    }

    // Instantly damages everything hostile in a large radius around the
    // player - a bigger, self-centered version of explosive ammo's splash.
    activateBigBomb(player, id) {
        this.explodeAt(player.x, player.y, id, BOMB_RADIUS);
        this.bombEffect = { x: player.x, y: player.y, radius: BOMB_RADIUS, expiresAt: Date.now() + 300 };
    }

    // Makes the player and the planet immune to damage for a few seconds -
    // see the shield-charge and strike checks in handleCollisions().
    activateHolyBubble() {
        this.holyBubbleUntil = Date.now() + HOLY_BUBBLE_DURATION_MS;
    }

    // Reanimate: on killing a bot, flip it to fight for you instead of
    // being destroyed, gated by its own cooldown. Setting its id to the
    // killer's player id (rather than the generic gameId hostile bots use)
    // is what makes the existing collision-exclusion rule treat it as an
    // extension of the player - immune to friendly fire from its owner,
    // still hostile to everything else.
    tryReanimateBot(bot, killerId, player) {
        if (!(player.powerUps['reanimate'] > 0)) {
            return false;
        }
        var currentTime = Date.now();
        var readyAt = player.abilityCooldowns['reanimate'] || 0;
        if (currentTime < readyAt) {
            return false;
        }
        player.abilityCooldowns['reanimate'] = currentTime + REANIMATE_COOLDOWN_MS;

        bot.friendly = true;
        bot.id = killerId;
        bot.health = REANIMATED_BOT_HEALTH;
        return true;
    }

    handleCollisions() {
        // Create a list of all the objects
        var allObjects = Object.values(this.players).concat(Object.values(this.objects).concat(this.planet));
        this.map.objects = allObjects;
        this.map.updateCollisions();

        var players = this.players;
        var collisions = this.map.collisions;
        var holyBubbleActive = !!(this.holyBubbleUntil && Date.now() < this.holyBubbleUntil);
        // Handle collsions here
        for (var i = 0; i < collisions.length; i++) {
            // Delete the bullet if they hit another object. Bullets never
            // interact with other bullets - without this check, sidewinder's
            // multiple bullets spawning at the same point simultaneously
            // would register as colliding with each other and immediately
            // wipe each other out before ever traveling anywhere.
            if (collisions[i].type === 'bullet' && collisions[i].uid in this.objects && collisions[i].hitBy.type !== 'bullet') {
                var bullet = this.objects[collisions[i].uid];
                if (bullet.explosive && collisions[i].hitBy.id !== 'powerUp') {
                    this.explodeAt(bullet.x, bullet.y, bullet.id);
                }
                if (bullet.chainLightning && (collisions[i].hitBy.type === 'asteroid' || collisions[i].hitBy.type === 'bot')) {
                    this.chainLightningFrom(bullet.x, bullet.y, bullet.id);
                }

                // Delete the bullet if ran out of health
                if (this.objects[collisions[i].uid].health <= 1) {
                    delete this.objects[collisions[i].uid];
                } else {
                    this.objects[collisions[i].uid].health -= 1;
                }

                // if Single player mode increase strikes
                if (this.type === 'single player') {
                    if (collisions[i].hitBy.id === 'planet') {
                        if (!holyBubbleActive && !this.consumeAnyShieldCharge()) {
                            this.strikes += 1;
                        }
                        delete this.objects[collisions[i].uid];

                        // check if the game ended because of strikes
                        this.checkIfGameEnds()
                    }
                }
            }

            // Handle collisions of asteroids
            if (collisions[i].type === 'asteroid' && collisions[i].uid in this.objects) {

                // Collision between asteroids and the planet
                if (collisions[i].hitBy.id === 'planet') {
                    if (!holyBubbleActive && !this.consumeAnyShieldCharge()) {
                        this.strikes += this.objects[collisions[i].uid].health;
                    }
                    if (collisions[i].uid in this.objects) {
                        delete this.objects[collisions[i].uid];
                        // check if the game ended because of strikes
                        this.checkIfGameEnds()
                        continue;
                    }
                }

                // Delete the asteroid if it ran out of health
                if (this.objects[collisions[i].uid].health <= 1) {
                    if (collisions[i].hitBy.id in players) {
                        players[collisions[i].hitBy.id].score += 1;
                        this.currentMapKills += 1;
                    }
                    delete this.objects[collisions[i].uid];
                } else {
                    this.objects[collisions[i].uid].health -= 1;
                    // Update the radius of the asteroid since the hp changed
                    this.objects[collisions[i].uid].updateRadius(this.asteroidRadius);
                }
            }

            // Handle collisions of bots - killable by player bullets or the player's ship
            if (collisions[i].type === 'bot' && collisions[i].uid in this.objects) {
                var hitBot = this.objects[collisions[i].uid];
                if (hitBot.health <= 1) {
                    var killerId = collisions[i].hitBy.id;
                    if (killerId in players) {
                        players[killerId].score += 1;
                        this.currentMapKills += 1;

                        if (!hitBot.friendly && this.tryReanimateBot(hitBot, killerId, players[killerId])) {
                            continue;
                        }
                    }
                    delete this.objects[collisions[i].uid];
                } else {
                    hitBot.health -= 1;
                }
            }

            // Delete the player if they got hit by something other than a power up
            if (collisions[i].type === 'player' && collisions[i].hitBy.id !== 'powerUp') {
                var id = collisions[i].id;

                // Holy bubble blocks all damage for free; otherwise a shield
                // charge absorbs this hit; otherwise an extra life respawns
                // the player somewhere safe instead of ending the game
                if (holyBubbleActive) {
                    continue;
                }
                if (players[id] && players[id].shieldCharges > 0) {
                    players[id].shieldCharges -= 1;
                    continue;
                }
                if (players[id] && players[id].extraLives > 0) {
                    players[id].extraLives -= 1;
                    this.respawnPlayer(id);
                    continue;
                }

                if (collisions[i].hitBy.id && collisions[i].hitBy.id in players) {
                    if (collisions[i].hitBy.id in players) {
                        players[collisions[i].hitBy.id].score += 1;
                    }
                }

                this.killPlayer(this.io, id);
            }

            // Collision between power up and player/bullet
            if (collisions[i].type === 'powerUp' && (collisions[i].hitBy.type === 'player' || collisions[i].hitBy.type === 'bullet')) {
                if (collisions[i].uid in this.objects && collisions[i].hitBy.id in players) {
                    const player = players[collisions[i].hitBy.id];
                    this.objects[collisions[i].uid].applyPowerUp(player, this.planet);
                    delete this.objects[collisions[i].uid];
                }
            }

            // Collision between power up and asteroid or planet
            if (collisions[i].type === 'powerUp' && (collisions[i].hitBy.type === 'asteroid' || collisions[i].hitBy.type === 'planet')) {
                if (collisions[i].uid in this.objects) {
                    delete this.objects[collisions[i].uid];
                }
            }
        }
    }

    // Updates the players positions and respond to controls
    updatePlayers() {
        // Loop through the player list and update their position and velocity
        var players = this.players;
        var shootingOrbits = this.shootingOrbits;

        // Loop through players and add forces of controls and planet
        for (var id in players) {
            var player = players[id];
            var controls = players[id].controls;
            var shotPower = players[id].shotPower;

            if (player.pendingAbility) {
                this.tryActivateAbility(player, id, player.pendingAbility);
                player.pendingAbility = null;
            }

            // If the player has fuel and they are pressing a thrust control down
            if ((player.fuel > 0) && (controls.x || controls.y || player.rightMouseDown)) {

                // lower their fuel when controls are engaged
                player.fuel -= player.fuelDrainRate;
                // dont lower it too much though
                if (player.fuel < 0) {
                    player.fuel = 0;
                }

                // If the right mouse btn is down calculate thrust force
                var mouseThrustForce = { x: 0, y: 0 };
                if (player.rightMouseDown === true && player.clientX && player.clientY) {
                    mouseThrustForce = player.calculateThrustForce(player.thrust, player);
                }

                // Get the magnitude of the mouse controls + key controls
                var controlForceMag = Math.sqrt(Math.pow(controls.x + mouseThrustForce.x, 2) + Math.pow(controls.y + mouseThrustForce.y, 2));

                players[id].thrusting = true;
                // normalize controlForce to have magnitude of player.thrust
                if (controlForceMag !== 0) {
                    var controlForce = {
                        x: (controls.x + mouseThrustForce.x) / controlForceMag * player.thrust,
                        y: (controls.y + mouseThrustForce.y) / controlForceMag * player.thrust
                    };

                    var isClockwise = ((controlForce.x) > 0 ? 1 : -1);
                    var angle = isClockwise * Math.acos(controlForce.y / Math.sqrt(controlForce.x * controlForce.x + controlForce.y * controlForce.y));
                    players[id].rotation = angle;

                    // add the control force to the player
                    player.addForce(controlForce);
                }
            } else {
                var p = players[id];
                var isClockwise = ((p.vx) > 0 ? 1 : -1);
                var angle = isClockwise * Math.acos(p.vy / Math.sqrt(p.vx * p.vx + p.vy * p.vy));
                players[id].rotation = angle;
                players[id].thrusting = false;
            }

            // add the planet's force to the player and update their position
            this.planet.addForce(player);
            player.update();

            // Player is pressing a movement control - recalculate the player orbit
            if (controls.x || controls.y || player.rightMouseDown) {
                var orbitParams = player.calculateOrbit(this.planet.mass);
                players[id].orbitParams = utils.deepCopy(orbitParams);
            }

            // Player mouse is down - calculate the shooting orbit
            if (player.leftMouseDown === true) {
                var bullet = new Bullet(player);
                var orbitParams = bullet.calculateShootingOrbit(shotPower, player, this.planet.mass);
                shootingOrbits[id] = utils.deepCopy(orbitParams);
                var currentTime = (new Date()).getTime();

                var shootX = (player.clientX - player.x);
                var shootY = (player.clientY - player.y);
                var isClockwise = ((shootX) > 0 ? 1 : -1);
                var angle = isClockwise * Math.acos(shootY / Math.sqrt(shootX * shootX + shootY * shootY));
                players[id].rotation = angle;

                if (player.autoFire && (currentTime - player.lastFireTime) > player.fireRate && player.bulletCount !== 0) {
                    this.spawnBullet(player);
                    this.fireSidewinderVolley(player);
                    player.bulletCount -= 1;
                    player.lastFireTime = currentTime;
                }
            }

            // Player mouse is down enable/disable autofire
            if (player.middleMouseDown === true) {
                player.autoFire = !player.autoFire;
                player.middleMouseDown = false;
            }

            // Player left mouse btn was released
            if (player.leftMouseUp === true) {
                player.leftMouseUp = false;
                var currentTime = (new Date()).getTime();
                if ((currentTime - player.lastFireTime) > player.fireRate && player.bulletCount !== 0) {
                    this.spawnBullet(player);
                    this.fireSidewinderVolley(player);
                    player.bulletCount -= 1;
                    player.lastFireTime = currentTime;
                }
            }

            // If a player is out of the map destroy them or load a new map
            if (this.checkOutOfBounds(player, this.mapRadius)) {
                if (!this.mapEnded) {
                    this.killPlayer(this.io, id);
                } else {
                    this.loadNewMap();
                }
            }

        }

    }


    // Check if a mass is out of bounds
    checkOutOfBounds(mass, radius) {
        var dist = Math.sqrt(Math.pow(mass.x, 2) + Math.pow(mass.y, 2))
        if (dist + mass.radius >= radius) {
            return true;
        } else {
            return false;
        }
    }

    // Find the player closest to (x, y), used by bots to pick a target
    nearestPlayer(x, y) {
        var closest = null;
        var closestDist = Infinity;
        for (var id in this.players) {
            var player = this.players[id];
            var dx = player.x - x;
            var dy = player.y - y;
            var dist = dx * dx + dy * dy;
            if (dist < closestDist) {
                closestDist = dist;
                closest = player;
            }
        }
        return closest;
    }

    // Find the nearest asteroid/hostile-bot to (x, y), used by homing
    // bullets/explosive ammo/chain lightning. Reanimated (friendly) bots are
    // excluded so a player's own abilities can't hurt their ally.
    nearestHostile(x, y) {
        var closest = null;
        var closestDist = Infinity;
        for (var uid in this.objects) {
            var obj = this.objects[uid];
            if (obj.type !== 'asteroid' && !(obj.type === 'bot' && !obj.friendly)) {
                continue;
            }
            var dx = obj.x - x;
            var dy = obj.y - y;
            var dist = dx * dx + dy * dy;
            if (dist < closestDist) {
                closestDist = dist;
                closest = obj;
            }
        }
        return closest;
    }

    // What a reanimated bot hunts: asteroids and hostile (non-friendly) bots,
    // never itself or other allies.
    nearestEnemyForBot(bot) {
        var closest = null;
        var closestDist = Infinity;
        for (var uid in this.objects) {
            var obj = this.objects[uid];
            if (obj.uid === bot.uid) {
                continue;
            }
            if (obj.type !== 'asteroid' && !(obj.type === 'bot' && !obj.friendly)) {
                continue;
            }
            var dx = obj.x - bot.x;
            var dy = obj.y - bot.y;
            var dist = dx * dx + dy * dy;
            if (dist < closestDist) {
                closestDist = dist;
                closest = obj;
            }
        }
        return closest;
    }

    // Shield and holy bubble both protect the planet using whichever
    // player's shield charge is available (there's only one in single
    // player, but this stays correct if that ever changes).
    consumeAnyShieldCharge() {
        for (var id in this.players) {
            if (this.players[id].shieldCharges > 0) {
                this.players[id].shieldCharges -= 1;
                return true;
            }
        }
        return false;
    }

    // Update all of the objects positions
    updateObjects() {
        var currentTime = (new Date()).getTime();
        // Collect bots that want to fire instead of spawning bullets into
        // this.objects while iterating over it below.
        var botsFiring = [];

        // Expire black holes before the main pass
        for (var uid in this.objects) {
            if (this.objects[uid].type === 'blackHole' && currentTime > this.objects[uid].expiresAt) {
                delete this.objects[uid];
            }
        }
        var blackHoles = Object.values(this.objects).filter((o) => o.type === 'blackHole');

        var frozen = !!(this.timeFreezeUntil && currentTime < this.timeFreezeUntil);

        // Apply the planet force to all the non player objects
        for (var uid in this.objects) {
            var object = this.objects[uid];
            if (object.type === 'blackHole') {
                // Stationary - no gravity/physics applied to it
                continue;
            }
            if (this.checkOutOfBounds(object, 2 * this.mapRadius)) {
                // Remove it if it is too far away
                delete this.objects[object.uid];
                continue;
            }
            if (object.type === 'bullet' && (currentTime - object.spawnedAt) > BULLET_LIFETIME_MS) {
                delete this.objects[object.uid];
                continue;
            }

            // Freeze time stops everything except the caster's own bullets,
            // so they can still land hits on the frozen targets.
            var exemptFromFreeze = object.type === 'bullet' && object.id === this.timeFreezeCasterId;
            if (frozen && !exemptFromFreeze) {
                continue;
            }

            this.planet.addForce(object);

            var consumedByBlackHole = false;
            for (var b = 0; b < blackHoles.length; b++) {
                if (this.applyBlackHoleForce(blackHoles[b], object)) {
                    consumedByBlackHole = true;
                    break;
                }
            }
            if (consumedByBlackHole) {
                delete this.objects[uid];
                continue;
            }

            if (object.type === 'bullet' && object.homing) {
                var homingTarget = this.nearestHostile(object.x, object.y);
                if (homingTarget) {
                    var hdx = homingTarget.x - object.x;
                    var hdy = homingTarget.y - object.y;
                    var hdist = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
                    object.addForce({ x: hdx / hdist * HOMING_STRENGTH, y: hdy / hdist * HOMING_STRENGTH });
                }
            }
            object.update();

            if (object.type === 'bot') {
                var target = object.friendly ? this.nearestEnemyForBot(object) : this.nearestPlayer(object.x, object.y);
                if (target && object.think(target, currentTime)) {
                    botsFiring.push(object);
                }
            }
        }

        botsFiring.forEach((bot) => {
            this.spawnBullet(bot);
            bot.lastFireTime = currentTime;
        });
    }
}

module.exports = Game;
