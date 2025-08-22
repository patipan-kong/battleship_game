class GameClient {
    constructor() {
        // Create global game client instance
        // Use the same host as the current page, but port 3000 for WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const wsUrl = `${protocol}//${host}:3000`;
        
        console.log('Connecting to Colyseus server at:', wsUrl);
        this.client = new Colyseus.Client(wsUrl);
        this.room = null;
        this.playerName = '';
        this.gameScene = null;
        this.pendingGameState = null;
    }

    async createRoom(isPrivate = false, passcode = '', config = {}) {
        try {
            const roomOptions = {
                name: window.playerName || 'Anonymous',
                isPrivate: isPrivate,
                passcode: passcode,
                shipCount: config.shipCount || 4,
                boardSize: config.boardSize || 14
            };
            
            this.room = await this.client.joinOrCreate('battleship', roomOptions);

            this.setupRoomEvents();
            showWaitingRoom(this.room.id, isPrivate, passcode);
            
            // Update room config display when room state is available
            if (this.room.state) {
                updateRoomConfig(config.shipCount, config.boardSize);
            }
            
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room: ' + error.message);
        }
    }

    async joinRoom(roomId, passcode = '') {
        try {
            console.log(`Attempting to join room ${roomId} with passcode: ${passcode ? '[PROTECTED]' : '[NONE]'}`);
            
            this.room = await this.client.joinById(roomId, {
                name: window.playerName || 'Anonymous',
                passcode: passcode
            });

            console.log(`Successfully joined room ${this.room.id}`);
            this.setupRoomEvents();
            
            // Show waiting room after joining
            // Check if room is private by looking at room metadata when available
            // For now, assume private if passcode was provided
            const isPrivate = Boolean(passcode);
            console.log(`Showing waiting room - isPrivate: ${isPrivate}`);
            showWaitingRoom(this.room.id, isPrivate, passcode);
            
            // Update room config display when room state is available
            if (this.room.state) {
                updateRoomConfig(this.room.state.shipCount, this.room.state.boardSize);
            }
            
        } catch (error) {
            console.error('Failed to join room:', error);
            alert('Failed to join room: ' + error.message);
        }
    }

    setupRoomEvents() {
        console.log(`📡 Setting up room events for room ${this.room.id}`);
        
        this.room.onStateChange((state) => {
            console.log(`📨 onStateChange triggered`);
            console.log(`🎯 Room config from state: shipCount=${state.shipCount}, boardSize=${state.boardSize}`);
            this.handleStateChange(state);
        });

        this.room.onMessage('game_phase_changed', (message) => {
            console.log(`🔄 Game phase changed message received:`, message);
            // Force handle the current state to ensure UI updates
            if (this.room.state) {
                this.handleStateChange(this.room.state);
            }
        });

        this.room.onMessage('game_over', (message) => {
            this.handleGameOver(message);
        });

        this.room.onLeave(() => {
            console.log('Left room');
            this.room = null;
        });

        this.room.onError((code, message) => {
            console.error('Room error:', code, message);
            alert('Room error: ' + message);
        });
    }

    handleStateChange(state) {
        console.log(`🔄 State change received - Phase: ${state.phase}, Players: ${state.players.length}`);
        console.log(`📊 Player details:`, state.players.map(p => ({ sessionId: p.sessionId, name: p.name, ready: p.ready })));
        
        // If game scene is not ready yet, store the state and return
        if (!this.gameScene) {
            console.log(`⏳ Game scene not ready, storing state for later`);
            this.pendingGameState = state;
            
            // If we're supposed to start the game and scene isn't ready, try to initialize it
            if (state.players.length === 2 && (state.phase === 'setup' || state.phase === 'waiting')) {
                console.log(`🎮 Need to start game but scene not ready - ensuring initialization`);
                if (!this.game) {
                    console.log(`🔧 Game not initialized, starting initialization...`);
                    showGameInterface();
                    updateGamePhase('Setup');
                    updateGameStatus('Initializing game...');
                    this.initializeGame();
                }
            }
            return;
        }
        
        updatePlayerCount(state.players.length);
        
        // Log current room config for debugging
        console.log(`🎮 Current room config: ships=${state.shipCount}, board=${state.boardSize}x${state.boardSize}`);
        updateRoomConfig(state.shipCount, state.boardSize);
        
        // Update opponent name
        const opponent = state.players.find(p => p.sessionId !== this.room.sessionId);
        if (opponent) {
            updateOpponentName(opponent.name);
        }

        // Handle different phases
        console.log(`🎯 Handling phase: ${state.phase}`);
        
        if (state.phase === 'playing') {
            console.log('🎮 GAME IS IN PLAYING PHASE!');
            updateGamePhase('Playing');
            
            const currentPlayer = state.players.find(p => p.sessionId === state.currentPlayer);
            if (currentPlayer) {
                updateCurrentTurn(currentPlayer.name);
                
                if (state.currentPlayer === this.room.sessionId) {
                    updateGameStatus('Your turn - Click on opponent\'s board to shoot!');
                } else {
                    updateGameStatus('Opponent\'s turn - Wait for their move');
                }
            }
            
            if (this.gameScene) {
                console.log('🎯 Calling enterPlayingPhase on game scene...');
                this.gameScene.enterPlayingPhase(state);
            } else {
                console.log('⚠️ Game scene not available for enterPlayingPhase');
            }
            
        } else if (state.players.length === 2 && (state.phase === 'setup' || state.phase === 'waiting')) {
            // Handle setup phase
            console.log(`🎮 STARTING GAME! Phase: ${state.phase}, Players: ${state.players.length}`);
            showGameInterface();
            updateGamePhase('Setup');
            updateGameStatus('Place your ships on the board');
            
            // Initialize game scene if not already done
            if (!this.gameScene) {
                console.log(`🔧 Initializing game scene...`);
                this.initializeGame();
                // Store the state for when the scene is ready
                this.pendingGameState = state;
                return;
            } else {
                console.log(`✅ Entering setup phase with game scene ready`);
                this.gameScene.enterSetupPhase(state);
            }
            
        } else if (state.phase === 'finished') {
            this.handleGameOver({
                winner: state.winner,
                winnerName: state.players.find(p => p.sessionId === state.winner)?.name
            });
        }

        // Update ships remaining
        const player = state.players.find(p => p.sessionId === this.room.sessionId);
        if (player) {
            const shipsRemaining = player.ships.filter(ship => !ship.destroyed).length;
            updateShipsRemaining(shipsRemaining);
        }

        // Update game scene with current state
        if (this.gameScene) {
            this.gameScene.updateGameState(state);
        }
    }

    handleGameOver(message) {
        const isWinner = message.winner === this.room.sessionId;
        const statusText = isWinner ? 
            `🎉 You won! Congratulations!` : 
            `💀 You lost! ${message.winnerName} won the game.`;
        
        updateGameStatus(statusText);
        updateGamePhase('Game Over');
        
        setTimeout(() => {
            alert(statusText + '\n\nClick OK to return to lobby.');
            this.leaveRoom();
        }, 2000);
    }

    initializeGame() {
        console.log(`🚀 Starting game initialization...`);
        
        // Check if there's already a global Phaser game instance
        if (window.game && window.game.destroy) {
            console.log(`🧹 Cleaning up existing global game instance`);
            window.game.destroy(true);
            window.game = null;
        }
        
        // Clear any existing game instance
        if (this.game) {
            console.log(`🧹 Cleaning up existing game instance`);
            this.game.destroy(true);
            this.game = null;
            this.gameScene = null;
        }
        
        // Make sure gameContainer is available
        const gameContainer = document.getElementById('gameContainer');
        if (!gameContainer) {
            console.error(`❌ Game container not found`);
            alert('Game container not found. Please refresh the page.');
            return;
        }
        
        // Clear the container
        gameContainer.innerHTML = '';
        
        // Initialize Phaser game
        const config = {
            type: Phaser.AUTO,
            width: 1200,
            height: 800,
            parent: 'gameContainer',
            backgroundColor: '#1e3c72',
            scene: [GameScene]
        };

        console.log(`🎮 Creating new Phaser game instance...`);
        this.game = new Phaser.Game(config);
        
        // Try multiple times to get the scene with increasing delays
        let attempts = 0;
        const maxAttempts = 10;
        
        const tryGetScene = () => {
            attempts++;
            console.log(`🔍 Attempting to get game scene (attempt ${attempts}/${maxAttempts})`);
            
            this.gameScene = this.game.scene.getScene('GameScene');
            
            if (this.gameScene) {
                console.log(`✅ Game scene found on attempt ${attempts}`);
                this.gameScene.setGameClient(this);
                console.log(`🔗 Game client set on scene`);
                
                // Process any pending game state
                if (this.pendingGameState) {
                    console.log(`📋 Processing pending game state...`);
                    this.handleStateChange(this.pendingGameState);
                    this.pendingGameState = null;
                }
                return;
            }
            
            // Try fallback method
            if (this.game.scene.scenes && this.game.scene.scenes.length > 0) {
                this.gameScene = this.game.scene.scenes[0];
                if (this.gameScene && this.gameScene.setGameClient) {
                    console.log(`✅ Game scene found using fallback method on attempt ${attempts}`);
                    this.gameScene.setGameClient(this);
                    console.log(`🔗 Game client set on scene (fallback)`);
                    
                    // Process any pending game state
                    if (this.pendingGameState) {
                        console.log(`📋 Processing pending game state (fallback)...`);
                        this.handleStateChange(this.pendingGameState);
                        this.pendingGameState = null;
                    }
                    return;
                }
            }
            
            // If not found and we haven't exceeded max attempts, try again
            if (attempts < maxAttempts) {
                console.log(`⏳ Scene not ready yet, retrying in ${50 * attempts}ms...`);
                setTimeout(tryGetScene, 50 * attempts);
            } else {
                console.error(`❌ Failed to initialize game scene after ${maxAttempts} attempts`);
                console.log('Debug info:', {
                    gameExists: !!this.game,
                    sceneManager: !!this.game?.scene,
                    scenes: this.game?.scene?.scenes?.length || 0,
                    sceneKeys: this.game?.scene?.keys || []
                });
                alert('Failed to initialize game. Please refresh the page and try again.');
            }
        };
        
        // Start trying to get the scene
        setTimeout(tryGetScene, 100);
    }

    // Game actions
    placeShip(shipId, x, y) {
        if (this.room) {
            this.room.send('place_ship', { shipId, x, y });
        }
    }

    rotateShip(shipId) {
        if (this.room) {
            this.room.send('rotate_ship', { shipId });
        }
    }

    playerReady() {
        if (this.room) {
            console.log('🔄 Player clicked Ready - sending ready message to server');
            this.room.send('ready');
            document.getElementById('readyBtn').classList.add('hidden');
            updateGameStatus('Waiting for opponent to be ready...');
        }
    }

    shoot(x, y) {
        if (this.room) {
            this.room.send('shoot', { x, y });
        }
    }

    autoPlaceShips() {
        if (this.room) {
            console.log('🎲 Auto-placing ships...');
            this.room.send('auto_place_ships');
        }
    }

    clearShips() {
        if (this.room) {
            console.log('🗑️ Clearing all ships...');
            this.room.send('clear_ships');
        }
    }

    leaveRoom() {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
        
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
            this.gameScene = null;
        }
    }
}


window.gameClient = new GameClient();