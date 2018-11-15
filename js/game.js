var game = new Phaser.Game(448, 496, Phaser.AUTO, "game");

var MainMenu = function (game) {
    this.button = null;

    var music;
};

MainMenu.prototype = {

    init: function () {
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        Phaser.Canvas.setImageRenderingCrisp(this.game.canvas);

    },

    preload: function () {
        this.load.image('logo', "assets/images/pacmanLogo.png");
        this.load.image('play', "assets/images/playLetters.png");
        this.load.audio('intro', "assets/audio/pacman_beginning.wav");
    },


    create: function () {


        this.add.sprite(this.world.centerX - 150, this.world.centerY - 130, 'logo');
        this.button = this.add.button(this.world.centerX - 100, this.world.centerY + 50,
            'play',
            function () {
                music.stop();
                game.state.start('Game');
            })
        music = this.add.audio('intro');
        music.play();


    }
}

var WinState = function(game) {
};

WinState.prototype = {
    init: function () {
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        Phaser.Canvas.setImageRenderingCrisp(this.game.canvas);

    },

    preload: function() {
        this.load.image('win', "assets/images/winnerText.png");
    },

    create: function() {
        this.add.sprite(this.world.centerX - 130, this.world.centerY - 50, 'win');
    }
};

var LoseState = function(game) {
};

LoseState.prototype = {
    init: function () {
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        Phaser.Canvas.setImageRenderingCrisp(this.game.canvas);

    },

    preload: function() {
        this.load.image('whoops', "assets/images/Whoops.png");
        this.load.image('lose', "assets/images/loserText.png");
    },

    create: function() {
        this.add.sprite(this.world.centerX - 130, this.world.centerY - 130, 'whoops');
        this.add.sprite(this.world.centerX - 130, this.world.centerY - 50, 'lose');
    }
}

var PacmanGame = function (game) {
    this.map = null;
    this.layer = null;
    this.timerespaw = 4;
    this.umbralExit = 5;
    this.score = 0;
    this.scoreText = null;

    this.pacman = null;
    this.currentGhost = 2;
    this.ghost = null;
    this.ghosts = [];
    this.enemies = 0;

    this.safetile = 14;
    this.gridsize = 16;
    this.threshold = 3;

    this.SPAWN_TILES = [{
        x: 13,
        y: 11
    }, {
        x: 15,
        y: 14
    }, {
        x: 14,
        y: 14
    }, {
        x: 13,
        y: 14
    }, {
        x: 12,
        y: 14
    }, {
        x: 16,
        y: 15
    }, {
        x: 11,
        y: 15
    }, {
        x: 11,
        y: 13
    }];

    this.SPECIAL_TILES = [{
        x: 12,
        y: 11
    }, {
        x: 15,
        y: 11
    }, {
        x: 12,
        y: 23
    }, {
        x: 15,
        y: 23
    }];

    this.DIRECTIONS = [{
        direction: Phaser.RIGHT
    }, {
        direction: Phaser.LEFT
    }, {
        direction: Phaser.RIGHT
    }, {
        direction: Phaser.LEFT
    }, {
        direction: Phaser.RIGHT
    }, {
        direction: Phaser.LEFT
    }, {
        direction: Phaser.RIGHT
    }, {
        direction: Phaser.LEFT
    }];

    this.TIME_MODES = [{
        mode: "scatter",
        time: 3000
    }, {
        mode: "chase",
        time: 10000
    }, {
        mode: "scatter",
        time: 3000
    }, {
        mode: "chase",
        time: 10000
    }, {
        mode: "scatter",
        time: 3000
    }, {
        mode: "chase",
        time: 10000
    }, {
        mode: "scatter",
        time: 3000
    }, {
        mode: "chase",
        time: -1 // -1 = infinite
    }];

    this.changeModeTimer = 0;
    this.remainingTime = 0;
    this.currentMode = 0;
    this.isPaused = false;
    this.isFrightened = false;
    this.FRIGHTENED_MODE_TIME = 7000;

    this.ghostExitRate = 2;
    this.ghostThreshold = 3;

    this.game = game;
    this.KEY_COOLING_DOWN_TIME = 250;

    var music;
    var eatingGhost;
    var pacmanDeath;
};

PacmanGame.prototype = {

    init: function () {
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;

        Phaser.Canvas.setImageRenderingCrisp(this.game.canvas);

        this.physics.startSystem(Phaser.Physics.ARCADE);
    },

    preload: function () {

        this.load.image("pill", "assets/images/pill.png");
        this.load.image('tiles', 'assets/images/pacman-tiles.png');
        this.load.spritesheet('ghosts', 'assets/images/ghosts.png', 32, 32);
        this.load.spritesheet('pacman', 'assets/images/pacman.png', 32, 32);
        this.load.tilemap('map', 'assets/pacman-map.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.audio('chomp', 'assets/audio/pacman_chomp.wav');
        this.load.audio('eatingGhost', 'assets/audio/pacman_eatghost.wav');
        this.load.audio('pacmanDeath', 'assets/audio/pacman_death.wav');

    },

    create: function () {
        this.map = this.add.tilemap('map');
        this.map.addTilesetImage('pacman-tiles', 'tiles');

        this.layer = this.map.createLayer('Pacman');


        this.pills = this.add.physicsGroup();
        this.numPills = this.map.createFromTiles(40, this.safetile, "pill", this.layer, this.pills);


        //  El jugador tiene colisión con todo excepto
        this.map.setCollisionByExclusion([this.safetile], true, this.layer);

        // Jugador
        this.pacman = new Pacman(this, "pacman");

        music = this.add.audio('chomp');
        music.loopFull(1);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.changeModeTimer = this.time.time + this.TIME_MODES[this.currentMode].time;

        // Enemigos
        this.enemies = Math.floor(Math.random() * (8 - 4 + 1) + 4);
        for (let index = 0; index < this.enemies; index++) {
            this.ghost = new Ghost(this, "ghosts", index, {
                x: this.SPAWN_TILES[index].x,
                y: this.SPAWN_TILES[index].y
            }, this.DIRECTIONS[index].direction);

            this.ghosts.push(this.ghost);
        }

        this.sendExitOrder(this.ghosts[1]);

    },

    checkMouse: function () {
        if (this.input.mousePointer.isDown) {
            var x = this.game.math.snapToFloor(Math.floor(this.input.x), this.gridsize) / this.gridsize;
            var y = this.game.math.snapToFloor(Math.floor(this.input.y), this.gridsize) / this.gridsize;
            this.debugPosition = new Phaser.Point(x * this.gridsize, y * this.gridsize);
            console.log(x, y);
        }
    },

    checkKeys: function () {
        this.pacman.checkKeys(this.cursors);

    },

    getCurrentMode: function () {
        if (!this.isPaused) {
            if (this.TIME_MODES[this.currentMode].mode === "scatter") {
                return "scatter";
            } else {
                return "chase";
            }
        } else {
            return "random";
        }
    },

    update: function () {
        if (!this.pacman.isDead) {

            for (var i = 0; i < this.ghosts.length; i++) {
                if (this.ghosts[i].mode !== this.ghosts[i].RETURNING_HOME) {
                    this.physics.arcade.overlap(this.pacman.sprite, this.ghosts[i].ghost, this.dogEatsDog, null, this);
                }
            }
            if (this.game.time.totalElapsedSeconds() > this.ghostExitRate &&
                this.game.time.totalElapsedSeconds() < this.ghostThreshold &&
                this.currentGhost < this.enemies) {
                if (!this.isPaused) {
                    this.sendExitOrder(this.ghosts[this.currentGhost]);
                    this.currentGhost++;
                }
                this.ghostExitRate = this.ghostExitRate + 2;
                this.ghostThreshold = this.ghostThreshold + 2;
            }

            if (this.changeModeTimer !== -1 && !this.isPaused && this.changeModeTimer < this.time.time) {
                this.currentMode++;
                this.changeModeTimer = this.time.time + this.TIME_MODES[this.currentMode].time;
                if (this.TIME_MODES[this.currentMode].mode === "chase") {
                    this.sendAttackOrder();
                } else {
                    this.sendScatterOrder();
                }
                console.log("new mode:", this.TIME_MODES[this.currentMode].mode, this.TIME_MODES[this.currentMode].time);
            }


            if (this.isPaused && this.changeModeTimer < this.time.time) {
                this.changeModeTimer = this.time.time + this.remainingTime;
                this.isPaused = false;
                this.isFrightened = false;
                if (this.TIME_MODES[this.currentMode].mode === "chase") {
                    this.sendAttackOrder();
                } else {
                    this.sendScatterOrder();
                }
                console.log("new mode:", this.TIME_MODES[this.currentMode].mode, this.TIME_MODES[this.currentMode].time);
            }
        }

        if(this.score === this.enemies * 10){
            music.stop();
            game.state.start('Win');
        }

        this.pacman.update();
        this.updateGhosts();

        this.checkMouse();
        this.checkKeys();
    },

    updateGhosts: function () {
        for (var i = 0; i < this.ghosts.length; i++) {
            this.ghosts[i].update();
        }
    },
    //Cuando existe un contacto entre un fantasma con el jugador deben pasar 2 cosas
    dogEatsDog: function (pacman, ghost) {
        //se  muere el fantasma porque el personaje comio una galleta super op 
        if (this.isPaused) {
            ghost.mode = ghost.RETURNING_HOME;
            ghost.ghostDestination = new Phaser.Point(14 * this.gridsize, 14 * this.gridsize);
            ghost.safetiles = [this.safetile, 35, 36];
            if (this.isFrightened) {
                ghost.kill();
                eatingGhost = this.add.audio('eatingGhost');
                eatingGhost.play();
                this.score += 10;
            }
        } else {
            // sino mata al pacman porque existio contacto
            this.killPacman();
        }
    },
    gimeMeExitOrder: function (ghost) {
        this.game.time.events.add(Math.random() * 3000, this.sendExitOrder, this, ghost);
    },
    killPacman: function () {
        this.pacman.isDead = true;
        pacmanDeath = this.add.audio('pacmanDeath');
        pacmanDeath.play();
        music.stop();
        this.stopGhosts();
        game.state.start('Lose');
        
    },

    stopGhosts: function () {
        for (var i = 0; i < this.ghosts.length; i++) {
            this.ghosts[i].mode = this.ghosts[i].STOP;
        }
    },

    enterFrightenedMode: function () {
        for (var i = 0; i < this.ghosts.length; i++) {
            this.ghosts[i].enterFrightenedMode();
        }
        if (!this.isPaused) {
            this.remainingTime = this.changeModeTimer - this.time.time;
        }
        this.changeModeTimer = this.time.time + this.FRIGHTENED_MODE_TIME;
        this.isPaused = true;
        this.isFrightened = true;
        console.log(this.remainingTime);
    },

    isSpecialTile: function (tile) {
        for (var q = 0; q < this.SPECIAL_TILES.length; q++) {
            if (tile.x === this.SPECIAL_TILES[q].x && tile.y === this.SPECIAL_TILES[q].y) {
                return true;
            }
        }
        return false;
    },

    render: function () {
        for (var i = 0; i < this.ghosts.length; i++) {
            var color = "rgba(0, 255, 255, 0.6)";
            switch (this.ghosts[i].name) {
                case 0:
                    color = "rgba(255, 0, 0, 0.6";
                    break;
                case 1:
                    color = "rgba(255, 105, 180, 0.6";
                    break;
                case 2:
                    color = "rgba(255, 165, 0, 0.6";
                    break;
                case 3:
                    color = "rgba(0, 255, 255, 0.6)";
                    break;
                case 4:
                    color = "rgba(255, 0, 0, 0.6";
                    break;
                case 5:
                    color = "rgba(255, 105, 180, 0.6";
                    break;
                case 6:
                    color = "rgba(255, 165, 0, 0.6";
                    break;
                case 7:
                    color = "rgba(0, 255, 255, 0.6)";
                    break;

            }
            if (this.ghosts[i].ghostDestination) {
                var x = this.game.math.snapToFloor(Math.floor(this.ghosts[i].ghostDestination.x), this.gridsize);
                var y = this.game.math.snapToFloor(Math.floor(this.ghosts[i].ghostDestination.y), this.gridsize);
                this.game.debug.geom(new Phaser.Rectangle(x, y, 16, 16), color);
            }
        }
        if (this.debugPosition) {
            this.game.debug.geom(new Phaser.Rectangle(this.debugPosition.x, this.debugPosition.y, 16, 16), "#00ff00");
        }
    },

    sendAttackOrder: function () {
        for (var i = 0; i < this.ghosts.length; i++) {
            this.ghosts[i].attack();
        }
    },

    sendExitOrder: function (ghost) {
        ghost.mode = ghost.EXIT_HOME;
    },

    sendScatterOrder: function () {
        for (var i = 0; i < this.ghosts.length; i++) {
            this.ghosts[i].scatter();
        }
    }

};

game.state.add('Game', PacmanGame);
game.state.add('Win', WinState);
game.state.add('Lose', LoseState);
game.state.add('MainMenu', MainMenu, true);
