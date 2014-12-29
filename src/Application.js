// devkit and module imports
import device;
import ui.View as View;
import ui.ImageView as ImageView;
import ui.SpriteView as SpriteView;
import ui.ParticleEngine as ParticleEngine;
import entities.Entity as Entity;
import entities.EntityPool as EntityPool;
import parallax.Parallax as Parallax;

// game imports
import src.config as config;
import src.effects as effects;
import src.utils as utils;

// math and utils shortcut references
var PI = Math.PI;
var min = Math.min;
var max = Math.max;
var choose = utils.choose;
var rollFloat = utils.rollFloat;
var rollInt = utils.rollInt;

// game constants
var BG_WIDTH = 576;
var BG_HEIGHT = 1024;

/**
 * Application Class
 * ~ automatically instantiated by devkit
 * ~ handles game initialization and loop
 * ~ the variable 'app' is a reference to the instance of Application
 */
var app;
exports = Class(GC.Application, function(supr) {
	/**
	 * initUI
	 * ~ called automatically by devkit
	 * ~ initialize view hierarchy and game elements
	 */
	this.initUI = function() {
		app = this;

		this.setScreenDimensions(BG_WIDTH > BG_HEIGHT);

		// gameView layer blocks input for faster player input handling
		this.gameView = new View({
			parent: this.view,
			width: this.view.style.width,
			height: this.view.style.height,
			blockEvents: true
		});
		this.player = new Player({ parent: this.gameView });
		this.parallax = new Parallax({ parent: this.gameView });
		this.bullets = new Bullets({ parent: this.gameView });
		this.enemies = new Enemies({ parent: this.gameView });
		this.particles = new ParticleEngine({
			parent: this.gameView,
			zIndex: 60
		});

		// input is on a separate layer to avoid traversing game elements
		this.input = new InputView({ parent: this.view });
	};

	/**
	 * launchUI
	 * ~ called automatically by devkit when its engine is ready
	 */
	this.launchUI = function() {
		this.reset();
	};

	/**
	 * setScreenDimensions
	 * ~ normalizes the game's root view to fit any device screen
	 */
	this.setScreenDimensions = function(horz) {
		var ds = device.screen;
		var vs = this.view.style;
		vs.width = horz ? ds.width * (BG_HEIGHT / ds.height) : BG_WIDTH;
		vs.height = horz ? BG_HEIGHT : ds.height * (BG_WIDTH / ds.width);
		vs.scale = horz ? ds.height / BG_HEIGHT : ds.width / BG_WIDTH;
	};

	/**
	 * reset
	 * ~ resets all game elements for a new game
	 */
	this.reset = function(data) {
		this.score = 0;
		this.gameOver = false;

		this.player.reset();
		this.parallax.reset(config.parallax);
		this.bullets.reset();
		this.enemies.reset();
		this.input.reset();
		this.particles.killAllParticles();
	};

	/**
	 * tick
	 * ~ called automatically by devkit for each frame
	 * ~ updates all game elements by delta time, dt
	 */
	this.tick = function(dt) {
		// update entities
		this.player.update(dt);
		this.parallax.update(0, 0);
		this.bullets.update(dt);
		this.enemies.update(dt);

		// collide bullets with enemies
		this.bullets.onFirstPoolCollisions(this.enemies, this.onBulletHit, this);

		// collide enemies with player
		this.enemies.onFirstCollision(this.player, this.onGameOver, this);

		// update particles
		this.particles.runTick(dt);
	};

	this.onBulletHit = function(bullet, enemy) {
		effects.emitExplosion(this.particles, enemy);
		enemy.release();
		bullet.release();
	};

	this.onGameOver = function() {
		if (!this.gameOver) {
			this.player.onDeath();
			effects.emitExplosion(this.particles, this.player);
			this.gameOver = true;
			setTimeout(bind(this, 'reset'), 2500);
		}
	};
});


/**
 * PlayerView Class
 * ~ defines a unique look for the player view
 * ~ used by the Player Class
 */
var PlayerView = Class(SpriteView, function() {
	var sup = SpriteView.prototype;
});


/**
 * Player Class
 */
var Player = Class(Entity, function() {
	var sup = Entity.prototype;
	var PLAYER_MOVE_MULT = config.player.inputMoveMultiplier;
	this.name = "Player";
	this.viewClass = PlayerView;

	this.init = function(opts) {
		sup.init.call(this, opts);

		this.inputStartX = 0;
		this.inputStartY = 0;
	};

	this.reset = function() {
		var superview = this.view.getSuperview();
		var s = superview.style;
		var x = s.width / 2;
		var y = s.height - 150;
		sup.reset.call(this, x, y, config.player);
	};

	this.startInput = function() {
		this.inputStartX = this.x;
		this.inputStartY = this.y;
	};

	this.updateInput = function(dx, dy) {
		dx *= PLAYER_MOVE_MULT;
		dy *= PLAYER_MOVE_MULT;
		this.x = max(0, min(BG_WIDTH, this.inputStartX + dx));
		this.y = max(0, min(BG_HEIGHT, this.inputStartY + dy));
	};

	this.onDeath = function() {
		this.view.style.visible = false;
	};
});


/**
 * Bullet Class
 * ~ an individual bullet
 */
var Bullet = Class(Entity, function() {
	var sup = Entity.prototype;
	this.name = "Bullet";

	this.init = function(opts) {
		opts.compositeOperation = "lighter";
		sup.init.call(this, opts);
	};

	this.update = function(dt) {
		sup.update.call(this, dt);
		var b = this.viewBounds;
		if (this.y + b.y + b.h < 0) {
			this.release();
		}
	};
});


/**
 * Bullets Class
 * ~ a collection of bullets
 */
var Bullets = Class(EntityPool, function() {
	var sup = EntityPool.prototype;
	var SPAWN_COOLDOWN = config.bullets.spawnCooldown;

	this.init = function(opts) {
		this.spawnCooldown = 0;
		opts.ctor = Bullet;
		sup.init.call(this, opts);
	};

	this.reset = function() {
		this.spawnCooldown = SPAWN_COOLDOWN;
		sup.reset.call(this);
	};

	this.update = function(dt) {
		this.spawnCooldown -= dt;
		if (this.spawnCooldown <= 0) {
			this.spawnBullet();
			this.spawnCooldown += SPAWN_COOLDOWN;
		}
		sup.update.call(this, dt);
	};

	this.spawnBullet = function() {
		if (app.gameOver) { return; }
		var x = app.player.x;
		var y = app.player.y;
		var bullet = this.obtain(x, y, config.bullets);
	};
});


/**
 * Enemy Class
 * ~ an individual enemy
 */
var Enemy = Class(Entity, function() {
	var sup = Entity.prototype;
	this.name = "Enemy";

	this.update = function(dt) {
		sup.update.call(this, dt);
		var b = this.viewBounds;
		if (this.y + b.y > BG_HEIGHT) {
			this.release();
		}
	};
});


/**
 * Enemies Class
 * ~ a collection of enemies
 */
var Enemies = Class(EntityPool, function() {
	var sup = EntityPool.prototype;

	this.init = function(opts) {
		opts.ctor = Enemy;
		sup.init.call(this, opts);
	};

	this.reset = function() {
		this.spawnCooldown = 0;
		this.spawnMin = config.enemies.spawnCooldownMin;
		this.spawnMax = config.enemies.spawnCooldownMax;
		sup.reset.call(this);
	};

	this.update = function(dt) {
		this.spawnCooldown -= dt;
		if (this.spawnCooldown <= 0) {
			this.spawnEnemy();
			this.spawnCooldown += rollFloat(this.spawnMin, this.spawnMax);
		}
		sup.update.call(this, dt);
	};

	this.spawnEnemy = function() {
		// increase game difficulty by spawning more enemies over time
		if (this.spawnMax > this.spawnMin) {
			this.spawnMax--;
		}

		var type = choose(config.enemies.types);
		var b = type.viewBounds;
		var x = rollFloat(0, BG_WIDTH);
		var y = -(b.y + b.h);
		var enemy = this.obtain(x, y, type);
	};
});


/**
 * InputView Class
 * ~ a view that manages game input
 */
var InputView = Class(View, function() {
	var sup = View.prototype;

	this.init = function(opts) {
		opts.infinite = true;
		sup.init.call(this, opts);
	};

	this.reset = function() {
		this.startEvt = null;
		this.startPt = null;
	};

	this.onInputStart = function(evt, pt) {
		if (this.startEvt === null) {
			app.player.startInput();
			this.startEvt = evt;
			this.startPt = pt;
		}
	};

	this.onInputMove = function(evt, pt) {
		var startEvt = this.startEvt;
		if (startEvt === null || evt.id !== startEvt.id) {
			return;
		}

		var startPt = this.startPt;
		var scale = 1 / app.gameView.style.scale;
		var dx = scale * (pt.x - startPt.x);
		var dy = scale * (pt.y - startPt.y);
		app.player.updateInput(dx, dy);
	};

	this.onInputSelect = function(evt, pt) {
		var startEvt = this.startEvt;
		if (startEvt === null || evt.id !== startEvt.id) {
			return;
		}

		this.reset();
	};
});
