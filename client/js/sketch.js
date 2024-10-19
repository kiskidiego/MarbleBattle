
class Item {
	name;
	cooldown;
	constructor(name, cooldown) {
		this.name = name;
		this.cooldown = cooldown;
	}
}
const BACKGROUND_COLOR = 150;
const GRID_COLOR = 100;
const GRID_STROKE_WEIGHT = 1;
const GRID_SPACING = 75;
const WORLD_COLOR = [69, 169, 103];
const WORLD_BORDER_COLOR = 0;
const WORLD_BORDER_STROKE_WEIGHT = 200;
const HOLE_COLOR = 0;
const HOLE_STROKE_COLOR = 0;
const HOLE_STROKE_WEIGHT = 30;
const PLAYER_STROKE_WEIGHT = 10;
const PLAYER_STROKE_COLOR_FACTOR = 0.8;
const WALL_COLOR_1 = [135, 85, 16];
const WALL_COLOR_2 = [232, 232, 71];
const WALL_COLOR_3 = [243, 48, 25];
const UI_COLOR = [250, 250, 250, 200];
const UI_WIDTH = 200;
const UI_HEIGHT = 265;
const UI_MARGIN = 30;
const UI_PADDING = 10;
const PICK_UP_COLORS = [
	[200, 200, 200],
	[115, 255, 129],
	[163, 214, 255],
	[253, 115, 255],
	[244, 255, 97]
]

var alive = true;
var socket;
var players = [];
var worldOffset = 0;
var worldSize;
var playerSize;
var playerNumber;
var holes = [];
var walls = [];
var pickUps = [];
var effects = [];
var items = [];
var cooldowns = [0, 0, 0, 0, 0, 0, 0, 0];
var mapIce = false;
var connected = false;
var playerName = "";
var mapMargin = 0;
function preload() {

}
function setup() {
	socket = io();
	createCanvas(windowWidth, windowHeight);
	socket.on('client_ingame', (data) => {
		//console.log("ingame");
		worldSize = data[0];
		playerSize = data[1];
		connected = true;
		rectMode(CORNER);
	});
	socket.on('print', (data) => {
		//console.log(data);
	});
	socket.on('draw', (data) => {
		////console.log(data[0][i]);
		players = data[0];
		let player = players[data[1]];
		////console.log(player);
		for (let i = 0; i < players.length; i++) {
			if (players[i].id == player.id) {
				////console.log(players[i].id);
				playerNumber = i;
				break;
			}
		}
		triangleStrength = data[2];
		walls = data[3];
		holes = data[4];
		mapMargin = data[5] + 45;
		pickUps = data[6];
		mapIce = data[7];
		effects = data[8];
		let i = 0;
		for(i = 0; i < data[9].length; i++){
			items[i] = new Item(data[9][i].name, data[9][i].cooldown);
		}
		if(items.splice(i, items.length - i).length > 0)
			cooldowns = [0, 0, 0, 0, 0, 0, 0, 0];
		

		worldOffset = [-data[0][playerNumber].x, -data[0][playerNumber].y];
	});
	socket.on('logout', (data) => {
		alive = false;
	});
}
function drawWorldGrid() {
	stroke(GRID_COLOR);
	strokeWeight(GRID_STROKE_WEIGHT);
	if (worldOffset != 0) {
		let initialX = worldOffset[0] + width / 2 - playerSize;
		let initialY = worldOffset[1] + height / 2 - playerSize;
		let finalX = worldSize + worldOffset[0] + width / 2 + playerSize;
		let finalY = worldSize + worldOffset[1] + height / 2 + playerSize;
		for (let i = 0; i < worldSize + playerSize; i += GRID_SPACING) {
			relativeI = RelativePosition(i, i);
			line(relativeI[0], initialY, relativeI[0], finalY);
			line(initialX, relativeI[1], finalX, relativeI[1]);
		}
	}
}
function draw() {
	if (!alive) 
	{
		background(BACKGROUND_COLOR);
		fill(UI_COLOR);
		rectMode(CENTER);
		noStroke();
		rect(width / 2, height / 2, 400, 200);
		fill(0);
		textSize(50);
		textAlign(CENTER, CENTER);
		text("You died", width / 2, height / 2 - 50);
		textSize(30);
		text("Press F5 to restart", width / 2, height / 2 + 20);
		return;
	}
	if (!connected) {
		drawLogin();
		return;
	}
	background(BACKGROUND_COLOR);
	if(!mapIce)
		fill(WORLD_COLOR);
	else
		fill(100, 100, 255);
	stroke(WORLD_BORDER_COLOR);
	strokeWeight(WORLD_BORDER_STROKE_WEIGHT);
	bgPosition = RelativePosition(mapMargin, mapMargin);
	square(bgPosition[0] - playerSize - WORLD_BORDER_STROKE_WEIGHT / 2, bgPosition[1] - playerSize - WORLD_BORDER_STROKE_WEIGHT / 2, worldSize - mapMargin * 2 + playerSize * 2 + WORLD_BORDER_STROKE_WEIGHT);
	drawWorldGrid();
	if (players.length <= 0) return;

	//Draw holes
	fill(HOLE_COLOR);
	stroke(HOLE_STROKE_COLOR)
	strokeWeight(HOLE_STROKE_WEIGHT)
	for (let i = 0; i < holes.length; i++) {
		circle(holes[i].x + worldOffset[0] + width / 2, holes[i].y + worldOffset[1] + height / 2, holes[i].radius * 2);
	}

	//Draw pickUps
	for (let i = 0; i < pickUps.length; i++) {
		if(pickUps.length <= 0) return;
		fill(PICK_UP_COLORS[pickUps[i].rarity]);
		stroke(0);
		strokeWeight(0);
		let relativePosition = RelativePosition(pickUps[i].x, pickUps[i].y);
		circle(relativePosition[0], relativePosition[1], pickUps[i].size)
		fill(UI_COLOR);
		textSize(20);
		textAlign(CENTER, CENTER);
		strokeWeight(0);
		text(pickUps[i].name, relativePosition[0], relativePosition[1]);
	}

	//Draw walls
	noStroke();
	for (let i = 0; i < walls.length; i++) {
		switch (walls[i].health) {
			case 3:
				fill(WALL_COLOR_1);
				break;
			case 2:
				fill(WALL_COLOR_2);
				break;
			case 1:
				fill(WALL_COLOR_3);
				break;
		}
		let relativePositions = [RelativePosition(walls[i].x1, walls[i].y1), RelativePosition(walls[i].x2, walls[i].y2), RelativePosition(walls[i].x3, walls[i].y3), RelativePosition(walls[i].x4, walls[i].y4)];
		quad(relativePositions[0][0], relativePositions[0][1], relativePositions[1][0], relativePositions[1][1], relativePositions[2][0], relativePositions[2][1], relativePositions[3][0], relativePositions[3][1]);
	}

	//Draw effects
	for (let i = 0; i < effects.length; i++) {
		//console.log(effects[i]);
		fill(effects[i].color);
		stroke(effects[i].color);
		strokeWeight(0);
		let relativePosition = RelativePosition(effects[i].position[0], effects[i].position[1]);
		if(effects[i].shape == "circle")
			circle(relativePosition[0], relativePosition[1], effects[i].range * 2);
		else if(effects[i].shape == "line") {
			strokeWeight(PLAYER_STROKE_WEIGHT);
			line(relativePosition[0], relativePosition[1], relativePosition[0] + effects[i].direction[0] * effects[i].range, relativePosition[1] + effects[i].direction[1] * effects[i].range);
		}
	}

	//Draw players
	fill(players[playerNumber].color)
	stroke(players[playerNumber].color[0] * PLAYER_STROKE_COLOR_FACTOR, players[playerNumber].color[1] * PLAYER_STROKE_COLOR_FACTOR, players[playerNumber].color[2] * PLAYER_STROKE_COLOR_FACTOR);
	strokeWeight(PLAYER_STROKE_WEIGHT);
	let directionVector = [width / 2 - mouseX, height / 2 - mouseY];
	let magnitude = Math.sqrt(directionVector[0] * directionVector[0] + directionVector[1] * directionVector[1]);
	let normalizedDirection = [directionVector[0] / magnitude, directionVector[1] / magnitude];
	line(width / 2, height / 2, width / 2 + normalizedDirection[0] * triangleStrength * 50, height / 2 + normalizedDirection[1] * triangleStrength * 50);
	circle(width / 2, height / 2, players[playerNumber].size * 2 - PLAYER_STROKE_WEIGHT);
	fill(UI_COLOR);
	textSize(20);
	textAlign(CENTER, CENTER);
	strokeWeight(0);
	text(players[playerNumber].name, width / 2, height / 2);

	for (let i = 0; i < players.length; i++) {
		if (i == playerNumber) continue;
		let player = players[i];
		fill(player.color[0], player.color[1], player.color[2]);
		stroke(player.color[0] * PLAYER_STROKE_COLOR_FACTOR, player.color[1] * PLAYER_STROKE_COLOR_FACTOR, player.color[2] * PLAYER_STROKE_COLOR_FACTOR);
		strokeWeight(PLAYER_STROKE_WEIGHT);
		circle(player.x + worldOffset[0] + width / 2, player.y + worldOffset[1] + height / 2, player.size * 2 - PLAYER_STROKE_WEIGHT);
		fill(UI_COLOR);
		strokeWeight(0);
		text(player.name, player.x + worldOffset[0] + width / 2, player.y + worldOffset[1] + height / 2);
	}

	//Draw HUD
	fill(UI_COLOR);
	stroke(0);
	strokeWeight(0);
	rectMode(CORNER);
	rect(width - UI_WIDTH - UI_MARGIN, UI_MARGIN, UI_WIDTH, UI_HEIGHT);
	fill(0);
	textSize(20);
	textAlign(LEFT, TOP);
	text("Items", width - UI_WIDTH + UI_MARGIN, UI_MARGIN + UI_PADDING);
	for(let i = 0; i < items.length; i++){
		if(cooldowns[i] > 0){
			fill(255, 0, 0);
			text(items[i].name + " - " + cooldowns[i] + "s", width - UI_WIDTH + UI_MARGIN/4, UI_MARGIN + UI_PADDING + 20 + 20 * i);
		}
		else{
			fill(0);
			text(items[i].name, width - UI_WIDTH + UI_MARGIN/4, UI_MARGIN + UI_PADDING + 20 + 20 * i);
		}
	}
	fill(150);
	text("Press 1-4 and\nthen q-r to use", width - UI_WIDTH, UI_MARGIN + UI_PADDING + 20 + 20 * items.length);
}
function drawLogin() {
	background(WORLD_COLOR);
	fill(UI_COLOR);
	rectMode(CENTER);
	noStroke();
	rect(width / 2, height / 2, 400, 200);
	fill(0);
	textSize(50);
	textAlign(CENTER, CENTER);
	text("Enter your name", width / 2, height / 2 - 50);
	textSize(30);
	text(playerName, width / 2, height / 2 + 20);
}
function mousePressed() {
	socket.emit('mouse_pressed', [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]);
}
function mouseDragged() {
	socket.emit('mouse_dragged', [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]);
}
function mouseReleased() {
	socket.emit('mouse_released', [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]);
}
function keyPressed() {
	if (!connected) {
		if (isLetter(key) && playerName.length < 13) {
			playerName += key;
		}
		else if (keyCode === BACKSPACE) {
			playerName = playerName.slice(0, playerName.length - 1);
		}
		else if (keyCode === ENTER) {
			socket.emit('login', playerName);
			//console.log("Logged in: " + playerName);
		}
		return;
	}
	if (keyCode === 32) {
		socket.emit('space_pressed', '');
	}
	if(keyCode === 49){
		socket.emit('item_used', [0, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 0 && items[0].cooldown > 0 && cooldowns[0] <= 0)
		{
			cooldowns[0] = items[0].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[0] > 0)
					cooldowns[0]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 50){
		socket.emit('item_used', [1, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 1 && items[1].cooldown > 0 && cooldowns[1] <= 0)
		{
			cooldowns[1] = items[1].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[1] > 0)
					cooldowns[1]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 51){
		socket.emit('item_used', [2, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 2 && items[2].cooldown > 0 && cooldowns[2] <= 0)
		{
			cooldowns[2] = items[2].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[2] > 0)
					cooldowns[2]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 52){
		socket.emit('item_used', [3, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 3 && items[3].cooldown > 0 && cooldowns[3] <= 0)
		{
			cooldowns[3] = items[3].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[3] > 0)
					cooldowns[3]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 81){
		socket.emit('item_used', [4, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 4 && items[4].cooldown > 0 && cooldowns[4] <= 0)
		{
			cooldowns[4] = items[4].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[4] > 0)
					cooldowns[4]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 87){
		socket.emit('item_used', [5, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 5 && items[5].cooldown > 0 && cooldowns[5] <= 0)
		{
			cooldowns[5] = items[5].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[5] > 0)
					cooldowns[5]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 69){
		socket.emit('item_used', [6, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 6 && items[6].cooldown > 0 && cooldowns[6] <= 0)
		{
			cooldowns[6] = items[6].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[6] > 0)
					cooldowns[6]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
	if(keyCode === 82){
		socket.emit('item_used', [7, [mouseX - width / 2 - worldOffset[0], mouseY - height / 2 - worldOffset[1]]]);
		if(items.length > 7 && items[7].cooldown > 0 && cooldowns[7] <= 0)
		{
			cooldowns[7] = items[7].cooldown / 1000;
			let interval = setInterval(() => {
				if(cooldowns[7] > 0)
					cooldowns[7]--;
				else
					clearInterval(interval);
			}, 1000);
		}
	}
}
function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}
function RelativePosition(x, y) {
	return [x + worldOffset[0] + width / 2, y + worldOffset[1] + height / 2];
}
function isLetter(c) {
	return c.length == 1;
}

document.addEventListener('keydown', (event) => {
	if (event.code === 'Space') {
		event.preventDefault();
	}
});
document.addEventListener('contextmenu', (event) => {
	event.preventDefault();
});