// TODO: replace all px/py with pieceX/pieceY for readability (semantics)
/*

- down the road, OPTIMIZE! probably make a single asset/SpriteSheet

things left before beta is done:
- finish flow (select pieces, earn points, drop bombs, etc.)
- music/sound effects from josh
- export to Android
- and iPhone

*/

/*
DGE.init({
	id : 'bombada',
	width : 480,
	height : 320
}).fill('#000');
*/

(function() {

var board = exports.board;

// Constants kinda.
var DEFAULT_NUM_MOVES = 1; // TODO: set back to 10 when done debugging gameover flow
var DELAY_ERROR = 100;
var DELAY_MATCH = 500;
var DELAY_MOVE = 250;
var DELAY_NOTICE = 750;
var FRAMES_FALLING = 30;
var MONEY_INCREMENT = 1;
var PIECE_SIZE = 36;
var PIECE_DOLLAR = 1;
var PIECE_BOMB = 3;
var PIECES_X = 8;
var PIECES_Y = 8;
var VELOCITY_PIECE = 15;
var Z_MODAL = 6; // The game over message stuff.
var Z_OVERLAY = 5; // Over everything but the stuff within the game over modal.
var Z_CURSOR = 4; // Above the pieces.
var Z_PIECE_MOVING = 3; // Moving, so above the other pieces to prevent visual clutter.
var Z_PIECE = 2; // Above the background.

var assets = {
	background : 'gfx/480x320/bg.png',
	cursor : 'gfx/480x320/cursor.png',
	soundOn : 'gfx/volume_on.png',
	soundOff : 'gfx/volume_off.png'
};
var audio;
var busy;
var highScore;
var pieceTypes = [
	'gfx/480x320/piece_diamond.png',
	'gfx/480x320/piece_money.png',
	'gfx/480x320/piece_coin.png',
	'gfx/480x320/piece_bomb.png',
	'gfx/480x320/piece_clock.png',
	'gfx/480x320/piece_key.png',
	'gfx/480x320/piece_pill.png'
];
var pieceWorth = [
	50, // Diamond.
	5, // Dollar.
	1 // Coin.
];
var player;
var sprites;

/**
 * Initializes Bombada.
 * @method init
 */
function init() {

	DGE.init({
		id : 'bombada',
		image : assets.background,
		width : 480,
		height : 320
	});

	highScore = DGE.Data.get('highScore');
	if (!highScore) highScore = 10000;
	DGE.Data.set('highScore', highScore);

	DGE.Text.defaults.color = '#FFF';
	DGE.Text.defaults.font = 'Lucida Grande, Helvetica, Sans-Serif';
	DGE.Text.defaults.shadow = '2px 2px 2px #000';
	DGE.Text.defaults.size = 20;
	DGE.Text.defaults.height = 30;

	board.set('getNewPiece', getNewPiece);

	new DGE.Loader([assets]);

	audio = {
		invalidMove : new DGE.Audio({
			file : 'audio/EnemyDeath.ogg'
		}),
		music : new DGE.Audio({
			file : 'audio/sly.ogg'
		}),
		soundOn : new DGE.Audio({
			file : 'audio/Powerup.ogg'
		})
	};

	sprites = {

		board : new DGE.Sprite({
			width : (PIECE_SIZE * PIECES_X),
			height : (PIECE_SIZE * PIECES_Y),
			x : 176,
			y : 16,
			z : Z_PIECE
		}),

		bombsIcon : new DGE.Sprite({
			image : pieceTypes[PIECE_BOMB],
			width : PIECE_SIZE,
			height : PIECE_SIZE,
			x : 10,
			y : 110
		}),

		bombsText : new DGE.Text({
			color : '#B62A04',
			size : 36,
			text : 0,
			width : 200,
			height : 42,
			x : 60,
			y : 110
		}).on('ping', function() {

			if (player.bombs == player.bombsTo) return;

			if (player.bombs < player.bombsTo) {
				player.bombs++;
			} else if (player.bombs > player.bombsTo) {
				player.bombs--;
			}

			this.set('text', DGE.formatNumber(player.bombs));

		}).start(),

		cursor : new DGE.Sprite({
			cursor : true,
			image : assets.cursor,
			width : 54,
			height : 54,
			x : 53,
			y : 2,
			z : Z_CURSOR
		}).on('ping', function() {

			var offset = 0.015;

			if (this.get('direction')) {
				this.offset('opacity', offset);
				if (this.get('opacity') >= 1) {
					this.set('direction', false);
				}
			} else {
				this.offset('opacity', -offset);
				if (this.get('opacity') <= 0.5) {
					this.set('direction', true);
				}
			}

		}).start(),

		modal : new DGE.Sprite({
			width : DGE.stage.width,
			height : DGE.stage.height,
			z : Z_MODAL
		}).hide(),

		moneyIcon : new DGE.Sprite({
			image : pieceTypes[PIECE_DOLLAR],
			width : PIECE_SIZE,
			height : PIECE_SIZE,
			x : 10,
			y : 150
		}),

		moneyText : new DGE.Text({
			color : '#449F24',
			size : 36,
			text : 0,
			width : 200,
			height : 42,
			x : 60,
			y : 150
		}).on('ping', function() {

			if (player.money == player.moneyTo) return;

			if (player.money < player.moneyTo) {
				player.money += MONEY_INCREMENT;
			} else if (player.money > player.moneyTo) {
				player.money -= MONEY_INCREMENT;
			}

			this.set('text', DGE.formatNumber(player.money));

		}).start(),

		moves : new DGE.Text({
			align : 'center',
			color : '#A3A4AA',
			size : 14,
			text : 'Moves Left',
			width : 170,
			height : 14,
			x : 0,
			y : 294
		}),

		movesText : new DGE.Text({
			align : 'center',
			font : 'Helvetica, Sans-Serif',
			size : 64,
			width : 170,
			height : 64,
			x : 0,
			y : 230
		}).on('ping', function() {

			if (player.moves == player.movesTo) return;

			if (player.moves < player.movesTo) {
				player.moves++;
			} else if (player.moves > player.movesTo) {
				player.moves--;
			}

			this.set('text', DGE.formatNumber(player.moves));

		}).start(),

		notice : new DGE.Text({
			align : 'center',
			width : 500,
			height : 50,
			z : Z_MODAL
		}).hide(),

		overlay : new DGE.Sprite({
			opacity : 0.9,
			width : DGE.stage.width,
			height : DGE.stage.height,
			z : Z_OVERLAY
		}).fill('#000').hide(),

		pieces : [],

/*
		speaker : new DGE.Sprite({
			cursor : true,
			image : assets.soundOn,
			width : 64,
			height : 53,
			x : 262,
			y : 30
		}).on('click', function() {

			if (DGE.Audio.enabled) {
				DGE.Audio.enabled = false;
				audio.music.pause();
				this.set('image', (assets.soundOff));
			} else {
				DGE.Audio.enabled = true;
				audio.music.play();
				audio.soundOn.play();
				this.set('image', (assets.soundOn));
			}

		}),
*/

		version : new DGE.Text({
			color : '#FFF',
			size : 8,
			text : 'v0.1',
			x : 140,
			y : 55
		})

	};

	sprites.gameOver = {
		header : new DGE.Text({
			align : 'center',
			parent : sprites.modal,
			size : 40,
			text : 'Game Over',
			width : DGE.stage.width,
			height : 50,
			y : 50
		}),
		yourScore : new DGE.Text({
			align : 'center',
			parent : sprites.modal,
			width : DGE.stage.width,
			height : 30,
			y : 120
		}),
		highScore : new DGE.Text({
			align : 'center',
			parent : sprites.modal,
			width : DGE.stage.width,
			height : 30,
			y : 145
		}),
		playAgain : new DGE.Text({
			align : 'center',
			cursor : true,
			parent : sprites.modal,
			width : DGE.stage.width,
			text : 'Play Again?',
			height : 30,
			y : 200
		}).on('click', newGame)

	};

	audio.music.play();
	newGame();

};

/**
 * Initiates a click on a piece.
 * @param {Number} px The X coordinate of the piece to click.
 * @param {Number} py The Y coordinate of the piece to click.
 * @method clickPiece
 */
function clickPiece(px, py) {

	if (busy) return;

	var pieceClicked = getPieceByPXY(px, py);

	sprites.cursor.centerOn(pieceClicked).show();

	var psx = player.selected.px;
	var psy = player.selected.py;

	player.selected = {
		px : px,
		py : py
	};

	if (!board.isAdjacent(psx, psy, px, py)) return;

	busy = true;
	var numToMove = 2;
	var pieceCursor = getPieceByPXY(psx, psy);

	board.swapPieces(px, py, psx, psy);

	var callbacks = {
		complete : function() {

			busy = !!(--numToMove);

			if (busy) return;

			if (board.hasMatches()) {
				execMatches();
			} else {

				audio.invalidMove.play();
				showNotice('Invalid move', '#EB0405', function() {
					busy = false;
					if (--player.movesTo == 0) gameOver();
				});

				var cursorToX = pieceClicked.x;
				var cursorToY = pieceClicked.y;
				var clickedToX = pieceCursor.x;
				var clickedToY = pieceCursor.y;

				pieceCursor.animate({
					x : cursorToX,
					y : cursorToY
				}, DELAY_ERROR);

				pieceClicked.animate({
					x : clickedToX,
					y : clickedToY
				}, DELAY_ERROR);

			}

		}
	};

	pieceCursor.animate({
		x : pieceClicked.x,
		y : pieceClicked.y
	}, DELAY_MOVE, callbacks);

	pieceClicked.animate({
		x : pieceCursor.x,
		y : pieceCursor.y
	}, DELAY_MOVE, callbacks);

};

/**
 * Clicks a piece based on X and Y coordinates (a helper function for clickPiece).
 * @param {Number} x The X coordinate of the piece to click.
 * @param {Number} y The Y coordinate of the piece to click.
 * @method clickPieceByCoords
 */
function clickPieceByCoords(x, y) {

	var px = ((x - 2) / PIECE_SIZE);
	var py = ((y - 1) / PIECE_SIZE);

	clickPiece(px, py);

};

/**
 * Executes any matches on the board.
 * @method execMatches
 */
function execMatches() {

	var matches = board.getPiecesMatched();
	var pieces = board.getPieces();

console.log('matches:', matches);

	for (var i = 0; i < matches.length; i++) {

		var x = matches[i].x;
		var y = matches[i].y;
		var piece = getPieceByPXY(x, y);

		piece.anchorToStage();

		switch (piece.get('type')) {
			case 0: // Diamond.
			case 1: // Money.
			case 2: // Coin.
				piece.set('angle', piece.getAngleTo(sprites.moneyIcon));
				piece.on('ping', function() {

					if (this.isTouching(sprites.moneyIcon)) {
						player.moneyTo += pieceWorth[this.get('type')];
						this.remove();
					}

				});
				break;
			case 3: // Bomb.
				piece.set('angle', piece.getAngleTo(sprites.bombsIcon));
				piece.on('ping', function() {

					if (this.isTouching(sprites.bombsIcon)) {
						player.bombsTo++;
						this.remove();
					}

				});
				break;
			case 4: // Clock.
				piece.set('angle', piece.getAngleTo(sprites.movesText.getCenter()));
				piece.on('ping', function() {

					if (this.isTouching(sprites.movesText)) {
						player.movesTo++;
						this.remove();
					}

				});
				break;
			default: // Everything else.
				piece.set('angle', 270);
				piece.set('framesMax', FRAMES_FALLING);
				piece.on('ping', function() {
					if (this.isOutOfBounds(true)) this.remove();
				});
				break;
		}

		piece.set('moving', true).start();
		pieces[x][y] = false;

	}

	board.setPieces(pieces);
	dropNewPieces();

};

/**
 * Drops new pieces.
 * @method dropNewPieces
 */
function dropNewPieces() {

	var toDrop = [];
	var pieces = board.getPieces();
	var stack = [];

	for (var x = 0; x < PIECES_X; x++) {
		for (var y = 0; y < PIECES_Y; y++) {
			if (pieces[x][y] === false) {

				var newPiece = false;
				var yAbove = (y - 1);

				if (y == 0) {
					newPiece = true;
				} else {
					if (pieces[x][yAbove] === false) {
						newPiece = true;
					} else {
						toDrop.push(getPieceByPXY(x, yAbove));
					}
				}

				if (newPiece) {

					stack[x] = ((stack[x] || 0) + 1);

					toDrop.push(makePiece(x, -stack[x], getNewPiece()));

				}

			}
		}
	}

	for (var i = 0; i < toDrop.length; i++) {

		toDrop[i]
			.set('angle', 270)
			.set('framesMax', FRAMES_FALLING)
			.set('moving', true)
			.on('ping', function() {
//DGE.log('uh...');
				
			}).start();

	}

};

/**
 * Shows the game over modal.
 * @method gameOver
 */
function gameOver() {

	sprites.gameOver.yourScore.set('text', ('Your Score: ' + DGE.formatNumber(player.money)));
	sprites.gameOver.highScore.set('text', ('High Score: ' + DGE.formatNumber(highScore)));

	sprites.modal.show();
	sprites.overlay.show();

};

/**
 * Gets a new (random) piece type for the board.
 * @return {Number} A random piece type.
 */
function getNewPiece() {

	if (DGE.rand(1, 10) == 1) { // 10% chance for a diamond.
		return 0;
	} else {
		return DGE.rand(1, (pieceTypes.length - 1));
	}

};

/**
 * Gets a piece by its piece X/Y coordinates.
 * @param {Number} px The X coordinate of the piece to click.
 * @param {Number} py The Y coordinate of the piece to click.
 * @return {Object} The Sprite at the passed piece coordinates.
 * @method getPieceByPXY
 */
function getPieceByPXY(px, py) {

	var testX = ((PIECE_SIZE * px) + 2);
	var testY = ((PIECE_SIZE * py) + 1);

	for (var x = 0; x < PIECES_X; x++) {
		for (var y = 0; y < PIECES_Y; y++) {

			var sprite = sprites.pieces[x][y];
			if (sprite.isAt(testX, testY)) return sprite;

		}
	}

	throw DGE.sprintf("Couldn't find a piece at %s, %s", px, py);

};

/**
 * Makes a new piece at the passed piece coordinates.
 * @param {Number} x The X coordinate of the piece to make.
 * @param {Number} y The Y coordinate of the piece to make.
 * @param {Number} type The type of piece to make.
 * @return {Object} The new piece.
 * @method makePiece
 */
function makePiece(x, y, type) {

	return new DGE.Sprite({
		cursor : true,
		image : pieceTypes[type],
		parent : sprites.board,
		pieceX : x,
		pieceY : y,
		type : type,
		velocity : VELOCITY_PIECE,
		width : PIECE_SIZE,
		height : PIECE_SIZE,
		x : ((PIECE_SIZE * x) + 2),
		y : ((PIECE_SIZE * y) + 1)
	}).on('click', function() {
		clickPieceByCoords(this.x, this.y);
	});

};

/**
 * Starts a new game.
 * @method newGame
 */
function newGame() {

	player = {
		bombs : 0,
		bombsTo : 0,
		money : 0,
		moneyTo : 0,
		moves : DEFAULT_NUM_MOVES,
		movesTo : DEFAULT_NUM_MOVES,
		selected : {}
	};

	board.reset();
	setBoard();
	sprites.cursor.hide();
	sprites.movesText.set('text', player.moves);

	sprites.modal.hide();
	sprites.overlay.hide();

};

/**
 * Sets up the board, including populating sprites.pieces appropriately and removing any old sprites.
 * @method setBoard
 */
function setBoard() {

	var pieces = board.getPieces();

	for (var x = 0; x < PIECES_X; x++) {

		if (!sprites.pieces[x]) {
			sprites.pieces[x] = [];
		}

		for (var y = 0; y < PIECES_Y; y++) {

			if (sprites.pieces[x][y]) {
				sprites.pieces[x][y].remove();
			}

			sprites.pieces[x][y] = makePiece(x, y, pieces[x][y]);

		}
	}

};

/**
 * Shows the user a notice message.
 * @param {String} text The text to display.
 * @param {String} color The color of the text.
 * @param {Function} complete (optional) The function to execute when complete.
 * @method showNotice
 */
function showNotice(text, color, complete) {

	sprites.notice
		.set({
			color : color,
			opacity : 1,
			size : 30,
			text : text
		})
		.show()
		.center()
		.animate({
			opacity : 0,
			size : 60
		}, DELAY_NOTICE, {
			complete : function() {
				this.hide();
				if (complete) complete();
			},
			tween : function() {
				this.center();
			}
		});

};

init();

})();
