// Importing libraries
var path = require('path');
var express = require('express');
var http = require('http');
var socketIO = require('socket.io');
const { create } = require('domain');

// Defining classes
class PlayerData {
	id;
	x;
	y;
	color;
	size;
	name;
	shielded;
	constructor(id, x, y, color, size, name, shielded) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.color = color;
		this.size = size;
		this.name = name;
		this.shielded = shielded;
	}
}
class Player {
	id;
	x;
	y;
	color;
	socket;
	name;
	items = [];
	shielded = false;
	weight = 1;
	size = PLAYER_SIZE;
	velocity = [0, 0];
	canCharge = true;
	charging = false;
	charge = 1;
	maxCharge = 30;
	chargeSpeed = 1.05;
	canStop = true;
	hit = null;
	kinetic = false;
	constructor(id, x, y, color, socket, name = "") {
		this.id = id;
		this.x = x;
		this.y = y;
		this.color = color;
		this.socket = socket;
		this.name = name;
	}
	RemoveItem(item) {
		this.items = this.items.filter((i) => {
			return i !== item;
		});
	}
}
class Hole {
	x;
	y;
	radius;
	constructor(x, y, radius) {
		this.x = x;
		this.y = y;
		this.radius = radius;
	}
}
class BoxCollider {
	x;
	y;
	a;
	b;
	c;
	d;
	determinant;
	IsInside(x, y) {
		let X = x - this.x;
		let Y = y - this.y;
		//console.log("a: " + this.a + " b: " + this.b + " c: " + this.c + " d: " + this.d + " determinant: " + this.determinant);
		//console.log("x: " + X + " y: " + Y);
		if (this.determinant === 0) return false;
		let hor = this.d * X - this.c * Y;
		let ver = -this.b * X + this.a * Y;
		if (this.determinant > 0) {
			//console.log(0 < hor && hor < this.determinant && 0 < ver && ver < this.determinant);
			return 0 < hor && hor < this.determinant && 0 < ver && ver < this.determinant;
		}
		else {
			//console.log(0 > hor && hor > this.determinant && 0 > ver && ver > this.determinant);
			return 0 > hor && hor > this.determinant && 0 > ver && ver > this.determinant;
		}
	}
	constructor(coords) {
		this.x = coords[0];
		this.y = coords[1];
		this.a = coords[2] - coords[0];
		this.b = coords[3] - coords[1];
		this.c = coords[6] - coords[0];
		this.d = coords[7] - coords[1];
		this.determinant = this.a * this.d - this.b * this.c;
	}
}
class Wall {
	x1;
	y1;
	x2;
	y2;
	x3;
	y3;
	x4;
	y4;
	globalCollider;
	rightCollider;
	leftCollider;
	topCollider;
	bottomCollider;
	horizontalBounds;
	verticalBounds;
	health = 3;
	IsTouching(x, y) {
		if (!this.globalCollider.IsInside(x, y)) 
			return [false];
		if (this.topCollider.IsInside(x, y)) {
			return [true, [this.verticalBounds[4] - this.x2, this.verticalBounds[5] - this.y2]];
		}
		if (this.bottomCollider.IsInside(x, y)) {
			return [true, [this.verticalBounds[2] - this.x3, this.verticalBounds[3] - this.y3]];
		}
		if (this.rightCollider.IsInside(x, y)) {
			return [true, [this.horizontalBounds[0] - this.x2, this.horizontalBounds[1] - this.y2]];
		}
		if (this.leftCollider.IsInside(x, y)) {
			return [true, [this.horizontalBounds[2] - this.x1, this.horizontalBounds[3] - this.y1]];
		}
		let distanceVector = [x - this.x1, y - this.y1];
		let sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < PLAYER_SIZE * PLAYER_SIZE) {
			return [true, distanceVector];
		}
		distanceVector = [x - this.x2, y - this.y2];
		sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < PLAYER_SIZE * PLAYER_SIZE) {
			return [true, distanceVector];
		}
		distanceVector = [x - this.x3, y - this.y3];
		sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < PLAYER_SIZE * PLAYER_SIZE) {
			return [true, distanceVector];
		}
		distanceVector = [x - this.x4, y - this.y4];
		sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < PLAYER_SIZE * PLAYER_SIZE) {
			return [true, distanceVector];
		}
		return [false];
	}
	constructor(x1, y1, x2, y2, x3, y3, x4, y4, collisionBounds, horizontalBounds, verticalBounds) {
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
		this.x3 = x3;
		this.y3 = y3;
		this.x4 = x4;
		this.y4 = y4;
		this.globalCollider = new BoxCollider(collisionBounds);
		this.rightCollider = new BoxCollider([horizontalBounds[0], horizontalBounds[1], x2, y2, x3, y3, horizontalBounds[6], horizontalBounds[7]]);
		this.leftCollider = new BoxCollider([x1, y1, horizontalBounds[2], horizontalBounds[3], horizontalBounds[4], horizontalBounds[5], x4, y4]);
		this.topCollider = new BoxCollider([x1, y1, x2, y2, verticalBounds[4], verticalBounds[5], verticalBounds[6], verticalBounds[7]]);
		this.bottomCollider = new BoxCollider([verticalBounds[0], verticalBounds[1], verticalBounds[2], verticalBounds[3], x3, y3, x4, y4]);
		this.horizontalBounds = horizontalBounds;
		this.verticalBounds = verticalBounds;
	}
}
class WallData {
	x1;
	y1;
	x2;
	y2;
	x3;
	y3;
	x4;
	y4;
	health;
	constructor(x1, y1, x2, y2, x3, y3, x4, y4, health) {
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
		this.x3 = x3;
		this.y3 = y3;
		this.x4 = x4;
		this.y4 = y4;
		this.health = health;
	}
}
class Pickup {
	x;
	y;
	size;
	name;
	item;
	rarity;
	constructor(x, y, size, name, item, rarity) {
		this.x = x;
		this.y = y;
		this.size = size;
		this.name = name;
		this.item = item;
		this.rarity = rarity;
	}
}
class PickupData {
	x;
	y;
	size;
	name;
	rarity;
	constructor(x, y, size, name, rarity) {
		this.x = x;
		this.y = y;
		this.size = size;
		this.name = name;
		this.rarity = rarity;
	}
}
class Item {
	name;
	cooldown;
	duration;
	effect;
	player = null;
	onCooldown = false;
	constructor(cooldown, duration, effect, name) {
		this.cooldown = cooldown;
		this.duration = duration;
		this.effect = effect;
		this.name = name;
	}
}
class ItemData {
	name;
	cooldown;
	constructor(name, cooldown) {
		this.name = name;
		this.cooldown = cooldown;
	}
}
class Jetpack extends Item {
	constructor(){
		super(20000, 5000, (player, vector) => {
			player.kinetic = true;
			let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
			let normal = [vector[0] / magnitude, vector[1] / magnitude];
			player.velocity = normal * 5;
			setTimeout(() => {
				player.kinetic = false;
			}, this.duration);
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
		}, "Jetpack");
	}
}
class JetpackPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Jetpack", new Jetpack(), 0);
	}
}
class Knockback extends Item {
	constructor(range){
		super(10000, 3000, (player) => {

			new Effect(500, "circle", [255, 0, 0], [player.x, player.y], range);
			
			for(let i = 0; i < playerList.length; i++) {
				if(playerList[i] === player) continue;
				if(playerList[i].shielded) continue;
				let distanceVector = [player.x - playerList[i].x, player.y - playerList[i].y];
				let sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
				if(sqrDistance < range * range) {
					let distance = Math.sqrt(sqrDistance);
					let normal = [distanceVector[0] / distance, distanceVector[1] / distance];
					let impulse = [normal[0] * 20, normal[1] * 20];
					playerList[i].velocity[0] -= impulse[0] / playerList[i].weight;
					playerList[i].velocity[1] -= impulse[1] / playerList[i].weight;
				}
			}
			
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
		}, "Knockback");
	}
}
class KnockbackPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Knockback", new Knockback(500), 0);
	}
}
class ShrinkRay extends Item {
	range
	constructor(range){
		super(10000, 3000, (player, vector) => {

			let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
			let normal = [vector[0] / magnitude, vector[1] / magnitude];
			let perpendicular = [normal[1] * player.size, -normal[0] * player.size];

			new Effect(500, "line", [255, 0, 255], [player.x, player.y], this.range, normal);

			let collider = new BoxCollider([player.x + perpendicular[0], player.y + perpendicular[1], player.x - perpendicular[0], player.y - perpendicular[1], 
				player.x + perpendicular[0] + normal[0] * this.range, player.y + perpendicular[1] + normal[1] * this.range, player.x - perpendicular[0] + normal[0] * this.range, player.y - perpendicular[1] + normal[1] * this.range]);
			let shrinkPlayers = [];
			for(let i = 0; i < playerList.length; i++) {
				if(playerList[i] === player) continue;
				if(playerList[i].shielded) continue;
				if(collider.IsInside(playerList[i].x, playerList[i].y)) {
					playerList[i].size /= 2;
					playerList[i].weight /= 2;
					shrinkPlayers.push(playerList[i]);
				}
			}
			setTimeout(() => {
				for(let i = 0; i < shrinkPlayers.length; i++) {
					if(shrinkPlayers[i] == null) continue;
					shrinkPlayers[i].size *= 2;
					shrinkPlayers[i].weight *= 2;
				}
			}, this.duration);
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
		}, "Shrink Ray");
		this.range = range;
	}
}
class ShrinkRayPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Shrink Ray", new ShrinkRay(1000), 0);
	}
}
class Shield extends Item {
	constructor(){
		super(30000, 10000, (player) => {
			player.shielded = true;
			setTimeout(() => {
				player.shielded = false;
			}, this.duration);
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
		}, "Shield");
	}
}
class ShieldPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Shield", new Shield(), 1);
	}
}
class AirCannon extends Item {
	range;
	constructor(range){
		super(30000, 10000, (player, vector) => {
			console.log(range);

			let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
			let normal = [vector[0] / magnitude, vector[1] / magnitude];

			new Effect(500, "line", [255, 255, 255], [player.x, player.y], this.range, normal);

			player.velocity[0] -= normal[0] * 3;
			player.velocity[1] -= normal[1] * 3;
			let perpendicular = [normal[1] * player.size, -normal[0] * player.size];
			let collider = new BoxCollider([player.x + perpendicular[0], player.y + perpendicular[1], player.x - perpendicular[0], player.y - perpendicular[1], 
				player.x + perpendicular[0] + normal[0] * this.range, player.y + perpendicular[1] + normal[1] * this.range, player.x - perpendicular[0] + normal[0] * this.range, player.y - perpendicular[1] + normal[1] * this.range]);
			for(let i = 0; i < playerList.length; i++) {
				if(playerList[i] === player) continue;
				if(playerList[i].shielded) continue;
				if(collider.IsInside(playerList[i].x, playerList[i].y)) {
					playerList[i].velocity[0] += normal[0] * 20;
					playerList[i].velocity[1] += normal[1] * 20;
				}
			}
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
		}, "Air Cannon");
		this.range = range;
	}
}
class AirCannonPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Air Cannon", new AirCannon(1000), 0);
	}
}
class FreezeRay extends Item {
	range;
	constructor(range){
		super(20000, 3000, (player, vector) => {

			let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
			let normal = [vector[0] / magnitude, vector[1] / magnitude];
			let perpendicular = [normal[1] * player.size, -normal[0] * player.size];
			let collider = new BoxCollider([player.x + perpendicular[0], player.y + perpendicular[1], player.x - perpendicular[0], player.y - perpendicular[1], 
				player.x + perpendicular[0] + normal[0] * this.range, player.y + perpendicular[1] + normal[1] * this.range, player.x - perpendicular[0] + normal[0] * this.range, player.y - perpendicular[1] + normal[1] * this.range]);
			let stunnedPlayers = [];

			new Effect(500, "line", [0, 0, 255], [player.x, player.y], this.range, normal);

			for(let i = 0; i < playerList.length; i++) {
				if(playerList[i] === player) continue;
				if(playerList[i].shielded) continue;
				if(collider.IsInside(playerList[i].x, playerList[i].y)) {
					playerList[i].velocity[0] = 0;
					playerList[i].velocity[1] = 0;
					playerList[i].stunned = true;
					stunnedPlayers.push(playerList[i]);
				}
			}
			setTimeout(() => {
				for(let i = 0; i < stunnedPlayers.length; i++) {
					if(stunnedPlayers[i] == null) continue;
					stunnedPlayers[i].stunned = false;
				}
			}, this.duration);
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
		}, "Freeze Ray");
		this.range = range;
	}
}
class FreezeRayPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Freeze Ray", new FreezeRay(1000), 2);
	}
}
class IceTotem extends Item {
	constructor(){
		super(-1, 30000, (player) => {
			mapIce = true;
			player.shielded = true;
			setTimeout(() => {
				mapIce = false;
				player.shielded = false;
			}, this.duration);
			player.RemoveItem(this);
		}, "Ice Totem");
	}
}
class IceTotemPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Ice Totem", new IceTotem(), 3);
	}
}
class TheRing extends Item {
	constructor(){
		super(-1, 10000, (player) => {
			player.shielded = true;
			let blackHoles = [];
			for(let i = 0; i < 2* Math.PI; i += Math.PI / 16) {
				blackHoles.push(new Hole(player.x + Math.cos(i) * 500, player.y + Math.sin(i) * 500, 50));
			}
			holeList = holeList.concat(blackHoles);
			setTimeout(() => {
				player.shielded = false;
				for(let i = 0; i < blackHoles.length; i++) {
					holeList.splice(holeList.indexOf(blackHoles[i]), 1);
				}
			}, this.duration);
			player.RemoveItem(this);
		}, "The Ring");
	}
}
class TheRingPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "The Ring", new TheRing(), 4);
	}
}
class WallBarrier extends Item {
	constructor(){
		super(30000, -1, (player, vector) => {
			let size = 500;
			let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
			let normal = [vector[0] / magnitude, vector[1] / magnitude];
			let perpendicular = [normal[1], -normal[0]];
			let sizeVector = [(normal[0] + perpendicular[0]) * size/2, (normal[1] + perpendicular[1]) * size/2];
			let negativePerpendicular = [-perpendicular[0], -perpendicular[1]];
			let negativeNormal = [-normal[0], -normal[1]];
			CreateWall(player.x - sizeVector[0], player.y - sizeVector[1], PLAYER_SIZE, size, perpendicular)
			CreateWall(player.x + sizeVector[0], player.y + sizeVector[1], PLAYER_SIZE, size, negativePerpendicular)
			CreateWall(player.x - sizeVector[0], player.y - sizeVector[1], PLAYER_SIZE, size, normal)
			CreateWall(player.x + sizeVector[0], player.y + sizeVector[1], PLAYER_SIZE, size, negativeNormal)
			this.onCooldown = true;
			setTimeout(() => {
				this.onCooldown = false;
			}, this.cooldown);
			}, "Wall Barrier");
	}
}
class WallBarrierPickup extends Pickup {
	constructor(x, y) {
		super(x, y, 20, "Wall Barrier", new WallBarrier(), 1);
	}
}
class Effect{
	duration;
	shape;
	position;
	range;
	color;
	direction;
	constructor(duration, shape, color, position, range, direction){
		this.duration = duration;
		this.shape = shape;
		this.color = color;
		this.position = position;
		this.range = range;
		this.direction = direction;
		effectsList.push(this);
		setTimeout(() => {
			effectsList.splice(effectsList.indexOf(this), 1);
		}, this.duration);
	}
}


//Defining constants
const WORLD_SIZE = 10000;
const PLAYER_SIZE = 45;
const HOLE_DENSITY = 0.000001;
const HOLE_RADIUS = 100;
const HOLE_RADIUS_VARIATION = 50;
const WALL_DENSITY = 0.0000015;
const WALL_WIDTH = 100;
const WALL_WIDTH_VARIATION = 100;
const WALL_LENGTH = 500;
const WALL_LENGTH_VARIATION = 250;
const COMMON_RARITY = 0.4;
const UNCOMMON_RARITY = 0.7;
const RARE_RARITY = 0.85;
const EPIC_RARITY = 0.95;
const LEGENDARY_RARITY = 1;
const STARTING_ITEMS = 20;

// Defining variables
var publicPath = path.join(__dirname, '../client');
var port = process.env.PORT || 3000;
var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var playerList = [];
var collisions = [];
var playerDataList = [];
var holeList = [];
var wallList = [];
var pickupList = [];
var pickupDataList = [];
var wallDataList = [];
var effectsList = [];
var updateWallData;
var updatePlayerData = false;
var updatePickupData = false;
var mapMargin = 0;
var mapIce = false;
var CommonItemList = [FreezeRayPickup, WallBarrierPickup];
var UnCommonItemList = [ShieldPickup, KnockbackPickup];
var RareItemList = [AirCannonPickup];
var EpicItemList = [IceTotemPickup];
var LegendaryItemList = [TheRingPickup];


// Connection event
io.on('connection', (socket) => {
	socket.loggedIn = false;
	

	//Set up event listeners
	socket.on('login', (data) => {
		console.log('login:', data);
		CreatePlayer(socket, data);
		//Send initial game info
		socket.emit('client_ingame', [WORLD_SIZE, PLAYER_SIZE]);
		socket.loggedIn = true;
	});
	console.log('New user connected: ' + socket.id);

	socket.on('disconnect', () => {
		if (!socket.loggedIn) return;
		console.log('User disconnected: ' + socket.id);
		DeletePlayer(socket);
	});
	socket.on('mouse_pressed', (data) => {
		if (!socket.loggedIn) return;
		console.log('mouse_pressed:', data);
		OnMouseDown(socket, data);
	});
	socket.on('mouse_dragged', (data) => {
		if (!socket.loggedIn) return;
		//console.log('mouse_dragged:', data);
		OnMouseDown(socket, data);
	});
	socket.on('mouse_released', (data) => {
		if (!socket.loggedIn) return;
		console.log('mouse_released:', data);
		OnMouseReleased(socket, data);
	});
	socket.on('space_pressed', (data) => {
		if (!socket.loggedIn) return;
		OnSpacePressed(socket);
	});
	socket.on('item_used', (data) => {
		if (!socket.loggedIn) return;
		if (data[0] >= socket.player.items.length) return;
		if (socket.player.items[data[0]].onCooldown) return;
		console.log('item_used:', data);
		directionVector = [data[1][0] - socket.player.x, data[1][1] - socket.player.y];
		socket.player.items[data[0]].effect(socket.player, directionVector);
	});
});

// Game functions
function CreatePlayer(socket, name) {
	let x;
	let y;
	do {
		x = Math.random() * (WORLD_SIZE - PLAYER_SIZE - mapMargin * 2) + mapMargin;
		y = Math.random() * (WORLD_SIZE - PLAYER_SIZE - mapMargin * 2) + mapMargin;
	} while (holeList.some((hole) => {
		let distanceVector = [x - hole.x, y - hole.y];
		let sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		return sqrDistance < (hole.radius + PLAYER_SIZE) * (hole.radius + PLAYER_SIZE);
	}))
	let color = [Math.random() * 245 + 10, Math.random() * 117 + 10, Math.random() * 117 + 10];

	socket.player = new Player(socket.id, x, y, color, socket, name);
	playerList.push(socket.player);
	//console.log(playerList[playerList.length - 1]);
	updatePlayerData = true;
}
function PlayerDeath(playerNumber) {
	let socket = playerList[playerNumber].socket;

	socket.emit('logout', null);
	socket.loggedIn = false;
	DeletePlayer(socket);
}
function DeletePlayer(socket) {
	
	playerList = playerList.filter((player) => {
		return player.id !== socket.id;
	});
	updatePlayerData = true;
}
function OnMouseDown(socket, data) {
	socket.player.charging = true;
}
function OnMouseReleased(socket, data) {
	if(socket.player.stunned) return;
	let charge = socket.player.charge;
	socket.player.charging = false;
	socket.player.charge = 1;
	if (!socket.player.canCharge) return;
	directionVector = [socket.player.x - data[0], socket.player.y - data[1]];
	magnitude = Math.sqrt(directionVector[0] * directionVector[0] + directionVector[1] * directionVector[1]);
	normal = [directionVector[0] / magnitude, directionVector[1] / magnitude];
	for (i = 0; i < 2; i++) {
		if(!mapIce || socket.player.shielded)
			socket.player.velocity[i] *= 0.5;
		socket.player.velocity[i] += normal[i] * charge;
	}
	socket.player.hit = null;
	console.log(socket.player.velocity);
	socket.player.canCharge = false;
	setTimeout(() => {
		socket.player.canCharge = true;
	}, 1000);
}
function OnSpacePressed(socket) {
	if(socket.player.stunned) return;
	if(!socket.player.canStop) return;
	if(mapIce && !socket.player.shielded) return;
	socket.player.velocity[0] = 0;
	socket.player.velocity[1] = 0;
	socket.player.charge = 10;
	socket.player.canStop = false;
	socket.player.canCharge = true;
	setTimeout(() => {
		socket.player.canStop = true;
	}, 3000);
}
function ProcessInput(player) {
	if (player === undefined) return;
	if (player.stunned) return;
	if (!player.charging) return;
	if (!player.canCharge) return;
	if (player.charge < player.maxCharge)
		player.charge *= player.chargeSpeed;
	else
		player.charge = player.maxCharge;
}
function PlayerCollision(player1, player2, distanceVector, sqrDistance) {
	let distance = Math.sqrt(sqrDistance);
	let normal = [distanceVector[0] / distance, distanceVector[1] / distance];
	let relativeVelocity = [player1.velocity[0] - player2.velocity[0], player1.velocity[1] - player2.velocity[1]];

	let velocityAlongNormal = relativeVelocity[0] * normal[0] + relativeVelocity[1] * normal[1];
	if (velocityAlongNormal > 0) return; // Already separating

	if (player1.velocity[0] === 0 && player1.velocity[1] === 0) {
		player1.hit = null;
	}
	if (player2.velocity[0] === 0 && player2.velocity[1] === 0) {
		player2.hit = null;
	}

	let player1Hit = player1.hit;
	let player2Hit = player2.hit;
	if (player2Hit !== null) {
		player1.hit = player2Hit;
	}
	else {
		player1.hit = player2;
	}
	if (player1Hit !== null) {
		player2.hit = player1Hit;
	}
	else {
		player2.hit = player1;
	}
	//player1.socket.emit('print', player1.hit.name);
	//player2.socket.emit('print', player2.hit.name);

	let impulse = [velocityAlongNormal * normal[0], velocityAlongNormal * normal[1]];

	player1.velocity[0] -= impulse[0] / player1.weight;
	player1.velocity[1] -= impulse[1] / player1.weight;
	player2.velocity[0] += impulse[0] / player2.weight;
	player2.velocity[1] += impulse[1] / player2.weight;
}
function CollisionWithWall(player, distanceVector) {
	//console.log(distanceVector);
	let distance = Math.sqrt(distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1]);
	let normal = [distanceVector[0] / distance, distanceVector[1] / distance];
	let velocityAlongNormal = player.velocity[0] * normal[0] + player.velocity[1] * normal[1];

	if (velocityAlongNormal > 0) return; // Already separating

	let impulse = [velocityAlongNormal * normal[0] * 2, velocityAlongNormal * normal[1] * 2];
	player.velocity[0] -= impulse[0] / player.weight;
	player.velocity[1] -= impulse[1] / player.weight;
}
function ProcessCollisions(currentPlayer) {
	let player = playerList[currentPlayer];
	//Hole Collisions
	if(player.x < mapMargin) {
		PlayerDeath(playerList.indexOf(player));
	}
	else if(player.y < mapMargin) {
		PlayerDeath(playerList.indexOf(player));
	}
	else if(player.x > WORLD_SIZE - mapMargin) {
		PlayerDeath(playerList.indexOf(player));
	}
	else if(player.y > WORLD_SIZE - mapMargin) {
		PlayerDeath(playerList.indexOf(player));
	}
	for (let i = 0; i < holeList.length; i++) {
		let distanceVector = [player.x - holeList[i].x, player.y - holeList[i].y];
		let sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < holeList[i].radius * holeList[i].radius) {
			PlayerDeath(currentPlayer);
			return;
		}
	}
	//Player Collisions
	let distance = (PLAYER_SIZE + PLAYER_SIZE) * (PLAYER_SIZE + PLAYER_SIZE);
	for (let i = 0; i < playerList.length; i++) {
		if (currentPlayer === i) continue;
		if (collisions.includes([i, currentPlayer])) continue;

		let distanceVector = [player.x - playerList[i].x, player.y - playerList[i].y];
		let sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < distance) {
			PlayerCollision(player, playerList[i], distanceVector, sqrDistance);
		}
	}
	//Wall Collisions
	for (let i = 0; i < wallList.length; i++) {
		result = wallList[i].IsTouching(player.x, player.y);
		if (!result[0])
			continue;
		CollisionWithWall(player, result[1]);
		wallList[i].health--;
		if (wallList[i].health === 0) {
			DeleteWall(i);
			CreateWall();
		}
		updateWallData = true;
		//console.log("Collision with wall: " + wallList[i].x1 + ", " + wallList[i].y1);
	}
	//Pickup Collisions
	if(player.items.length >= 8) return;
	for (let i = 0; i < pickupList.length; i++) {
		let distanceVector = [player.x - pickupList[i].x, player.y - pickupList[i].y];
		let sqrDistance = distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1];
		if (sqrDistance < (player.size + pickupList[i].size) * (player.size + pickupList[i].size)) {
			player.items.push(pickupList[i].item);
			pickupList.splice(i, 1);
			updatePickupData = true;
		}
	}
}
function UpdatePosition(player) {
	//console.log(player.velocity);
	//console.log(player.x, player.y);
	player.x += player.velocity[0];
	player.y += player.velocity[1];
	if(mapIce && !player.shielded) return;
	player.velocity[0] *= 0.975;
	player.velocity[1] *= 0.975;
	sqrVelocity = player.velocity[0] * player.velocity[0] + player.velocity[1] * player.velocity[1];
	if (sqrVelocity < 1) {
		player.velocity[0] = 0;
		player.velocity[1] = 0;
	}
	
}
function UpdateGameState() {
	if(playerList.length === 0) return;
	for (let i = playerList.length - 1; i >= 0; i--) {
		UpdatePosition(playerList[i]);
		ProcessCollisions(i);
		ProcessInput(playerList[i]);
	}
}
function GenerateData(i, updateAll) {
	if(updateAll) {
		if (playerList.length === 0) return;
		if (updatePlayerData) {
			playerDataList = playerList.map((player) => {
				return new PlayerData(player.id, player.x, player.y, player.color, player.size, player.name, player.shielded);
			});
			updatePlayerData = false;
		}
		else {
			for(let j = 0; j < playerList.length; j++) {
				playerDataList[j].x = playerList[j].x;
				playerDataList[j].y = playerList[j].y;
				playerDataList[j].size = playerList[j].size;
				playerDataList[j].shielded = playerList[j].shielded;
			}
		}
		if (updateWallData) {
			wallDataList = wallList.map((wall) => {
				return new WallData(wall.x1, wall.y1, wall.x2, wall.y2, wall.x3, wall.y3, wall.x4, wall.y4, wall.health);
			});
			updateWallData = false;
		}
		if (updatePickupData) {
			pickupDataList = pickupList.map((pickup) => {
				return new PickupData(pickup.x, pickup.y, pickup.size, pickup.name, pickup.rarity);
			});
			updatePickupData = false;
		}
	}
	if (playerList[i].charging && playerList[i].canCharge) {
		charge = playerList[i].charge;
	}
	else {
		charge = 0;
	}
	let itemDataList = playerList[i].items.map((item) => {
		return new ItemData(item.name, item.cooldown);
	});
	return [playerDataList, i, charge, wallDataList, holeList, mapMargin, pickupDataList, mapIce, effectsList, itemDataList];
}
function SendData() {
	if(playerList.length === 0) return;
	update = true;
	for (let i = playerList.length - 1; i >= 0; i--) {
		let data = GenerateData(i, update);
		update = false;
		playerList[i].socket.emit('draw', data);
	}
}
function SetUpHoles() {
	for (let i = 0; i < WORLD_SIZE * WORLD_SIZE * HOLE_DENSITY; i++) {
		let radius = Math.random() * HOLE_RADIUS_VARIATION + HOLE_RADIUS;
		holeList.push(new Hole(Math.random() * (WORLD_SIZE - radius * 2) + radius, Math.random() * (WORLD_SIZE - radius * 2) + radius, radius));
	}
}
function DeleteWall(index) {
	wallList.splice(index, 1);
	updateWallData = true;
}
function CreateWall(x1, y1, width, length, forwardVector)
{
	if(x1 === undefined) x1 = Math.random() * WORLD_SIZE - mapMargin * 2 + mapMargin;
	if(y1 === undefined) y1 = Math.random() * WORLD_SIZE - mapMargin * 2 + mapMargin;
	if(width === undefined) width = Math.random() * WALL_WIDTH_VARIATION + WALL_WIDTH;
	if(length === undefined) length = Math.random() * WALL_LENGTH_VARIATION + WALL_LENGTH;
	if(forwardVector === undefined)forwardVector = [Math.random() * 2 - 1, Math.random() * 2 - 1];
	let magnitude = Math.sqrt(forwardVector[0] * forwardVector[0] + forwardVector[1] * forwardVector[1]);
	forwardVector = [forwardVector[0] / magnitude, forwardVector[1] / magnitude];
	let sidewaysVector = [forwardVector[1], -forwardVector[0]];
	let x2 = x1 + sidewaysVector[0] * width;
	let y2 = y1 + sidewaysVector[1] * width;
	let x3 = x2 + forwardVector[0] * length;
	let y3 = y2 + forwardVector[1] * length;
	let x4 = x3 - sidewaysVector[0] * width;
	let y4 = y3 - sidewaysVector[1] * width;
	let horizontalX1 = x1 - sidewaysVector[0] * PLAYER_SIZE;
	let horizontalY1 = y1 - sidewaysVector[1] * PLAYER_SIZE;
	let horizontalX2 = x2 + sidewaysVector[0] * PLAYER_SIZE;
	let horizontalY2 = y2 + sidewaysVector[1] * PLAYER_SIZE;
	let horizontalX3 = x3 + sidewaysVector[0] * PLAYER_SIZE;
	let horizontalY3 = y3 + sidewaysVector[1] * PLAYER_SIZE;
	let horizontalX4 = x4 - sidewaysVector[0] * PLAYER_SIZE;
	let horizontalY4 = y4 - sidewaysVector[1] * PLAYER_SIZE;
	let horizontalBounds = [horizontalX1, horizontalY1, horizontalX2, horizontalY2, horizontalX3, horizontalY3, horizontalX4, horizontalY4];
	let verticalX1 = x1 - forwardVector[0] * PLAYER_SIZE;
	let verticalY1 = y1 - forwardVector[1] * PLAYER_SIZE;
	let verticalX2 = x2 - forwardVector[0] * PLAYER_SIZE;
	let verticalY2 = y2 - forwardVector[1] * PLAYER_SIZE;
	let verticalX3 = x3 + forwardVector[0] * PLAYER_SIZE;
	let verticalY3 = y3 + forwardVector[1] * PLAYER_SIZE;
	let verticalX4 = x4 + forwardVector[0] * PLAYER_SIZE;
	let verticalY4 = y4 + forwardVector[1] * PLAYER_SIZE;
	let verticalBounds = [verticalX1, verticalY1, verticalX2, verticalY2, verticalX3, verticalY3, verticalX4, verticalY4];
	let globalBoundX1 = horizontalX1 - forwardVector[0] * PLAYER_SIZE;
	let globalBoundY1 = horizontalY1 - forwardVector[1] * PLAYER_SIZE;
	let globalBoundX2 = horizontalX2 - forwardVector[0] * PLAYER_SIZE;
	let globalBoundY2 = horizontalY2 - forwardVector[1] * PLAYER_SIZE;
	let globalBoundX3 = horizontalX3 + forwardVector[0] * PLAYER_SIZE;
	let globalBoundY3 = horizontalY3 + forwardVector[1] * PLAYER_SIZE;
	let globalBoundX4 = horizontalX4 + forwardVector[0] * PLAYER_SIZE;
	let globalBoundY4 = horizontalY4 + forwardVector[1] * PLAYER_SIZE;
	let collisionBounds = [globalBoundX1, globalBoundY1, globalBoundX2, globalBoundY2, globalBoundX3, globalBoundY3, globalBoundX4, globalBoundY4];
	wallList.push(new Wall(x1, y1, x2, y2, x3, y3, x4, y4, collisionBounds, horizontalBounds, verticalBounds));
	updateWallData = true;
}
function SetUpWalls() {
	for (let i = 0; i < WORLD_SIZE * WORLD_SIZE * WALL_DENSITY; i++) {
		CreateWall();
	}
}
function CreatePickup() {
	let rarity = Math.random();
	let x = Math.random() * (WORLD_SIZE - mapMargin * 2) + mapMargin;
	let y = Math.random() * (WORLD_SIZE - mapMargin * 2) + mapMargin;
	if (rarity < COMMON_RARITY) {
		pickupList.push(new CommonItemList[Math.floor(Math.random() * CommonItemList.length)](x, y));
	}
	else if (rarity < UNCOMMON_RARITY) {
		pickupList.push(new UnCommonItemList[Math.floor(Math.random() * UnCommonItemList.length)](x, y));
	}
	else if (rarity < RARE_RARITY) {
		pickupList.push(new RareItemList[Math.floor(Math.random() * RareItemList.length)](x, y));
	}
	else if (rarity < EPIC_RARITY) {
		pickupList.push(new EpicItemList[Math.floor(Math.random() * EpicItemList.length)](x, y));
	}
	else {
		pickupList.push(new LegendaryItemList[Math.floor(Math.random() * LegendaryItemList.length)](x, y));
	}
	updatePickupData = true;
}
function SetUpPickups() {
	for (let i = 0; i < STARTING_ITEMS; i++) {
		CreatePickup();
	}
}		
function shrinkMap() {
	mapMargin += 1;
}

// Game Setup
SetUpHoles();
SetUpWalls();
SetUpPickups();

// Starting server
app.use(express.static(publicPath));
server.listen(port, () => {
	console.log('Server is up on port ' + port);
});

// Physics Update event
setInterval(() => {
	UpdateGameState();
}, 1000 / 120);

// Data Update event
setInterval(() => {
	SendData();
}, 1000 / 30);

// Map shrink event
setTimeout(() => {
	setInterval(() => {
		shrinkMap();
	}, 1000/30);
}, 20000);

// Pickup spawn event
setInterval(() => {
	CreatePickup();
}, 30000);