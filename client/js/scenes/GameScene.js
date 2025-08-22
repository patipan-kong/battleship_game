class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.gameClient = null;
        this.gameState = null;
        this.boardSize = 14; // Default, will be updated from game state
        this.cellSize = 30;
        this.playerBoard = null;
        this.opponentBoard = null;
        this.ships = [];
        this.selectedShip = null;
        this.draggedShip = null;
        this.phase = 'waiting';
        
        // Arrays to track dynamic graphics for cleanup
        this.boardMarkers = [];
        this.shipGraphics = [];
        this.coordinateLabels = []; // Track coordinate labels for cleanup
    }

    setGameClient(gameClient) {
        this.gameClient = gameClient;
    }

    create() {
        this.createBoards();
        this.createLabels();
        this.setupInputEvents();
    }

    createBoards() {
        const boardStartX = 50;
        const boardStartY = 100;
        const boardSpacing = this.boardSize * this.cellSize + 100;

        // Player board (left side)
        this.playerBoard = this.createBoard(boardStartX, boardStartY, 0x003366, 'Your Fleet');
        
        // Opponent board (right side)  
        this.opponentBoard = this.createBoard(boardStartX + boardSpacing, boardStartY, 0x660033, 'Enemy Waters');
        this.opponentBoard.interactive = false; // Initially disabled
    }

    createBoard(x, y, color, title) {
        const board = {
            container: this.add.container(x, y),
            cells: [],
            graphics: this.add.graphics(),
            title: this.add.text(x + (this.boardSize * this.cellSize) / 2, y - 30, title, {
                fontSize: '20px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5)
        };

        // Create grid
        for (let row = 0; row < this.boardSize; row++) {
            board.cells[row] = [];
            for (let col = 0; col < this.boardSize; col++) {
                const cell = this.add.rectangle(
                    x + col * this.cellSize + this.cellSize / 2,
                    y + row * this.cellSize + this.cellSize / 2,
                    this.cellSize - 1,
                    this.cellSize - 1,
                    color
                );
                
                cell.setStrokeStyle(1, 0xffffff, 0.3);
                cell.setData('gridX', col);
                cell.setData('gridY', row);
                
                board.cells[row][col] = cell;
            }
        }

        // Add coordinate labels
        for (let i = 0; i < this.boardSize; i++) {
            // Row numbers
            const rowLabel = this.add.text(x - 20, y + i * this.cellSize + this.cellSize / 2, (i + 1).toString(), {
                fontSize: '12px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            this.coordinateLabels.push(rowLabel);
            
            // Column letters
            const colLabel = this.add.text(x + i * this.cellSize + this.cellSize / 2, y - 20, String.fromCharCode(65 + i), {
                fontSize: '12px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            this.coordinateLabels.push(colLabel);
        }

        return board;
    }

    createLabels() {
        // Phase indicator
        this.phaseText = this.add.text(600, 30, 'Waiting for game to start...', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Turn indicator
        this.turnText = this.add.text(600, 60, '', {
            fontSize: '18px',
            fill: '#ffff00'
        }).setOrigin(0.5);
    }

    setupInputEvents() {
        // Right-click to rotate ships
        this.input.on('pointerdown', (pointer, gameObjects) => {
            if (pointer.rightButtonDown() && this.phase === 'setup') {
                const ship = gameObjects.find(obj => obj.getData('ship'));
                if (ship) {
                    const shipData = ship.getData('ship');
                    this.gameClient.rotateShip(shipData.id);
                }
            }
        });

        // Drag and drop for ship placement
        this.input.on('dragstart', (pointer, gameObject) => {
            if (this.phase === 'setup') {
                this.draggedShip = gameObject.getData('ship');
                // Apply tint to all segments in the container
                gameObject.list.forEach(child => {
                    if (child.setTint) {
                        child.setTint(0xff6666);
                    }
                });
            }
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.phase === 'setup') {
                gameObject.x = dragX;
                gameObject.y = dragY;
            }
        });

        this.input.on('dragend', (pointer, gameObject) => {
            if (this.phase === 'setup' && this.draggedShip) {
                const dropPoint = this.getGridPosition(gameObject.x, gameObject.y, this.playerBoard);
                
                if (dropPoint) {
                    this.gameClient.placeShip(this.draggedShip.id, dropPoint.x, dropPoint.y);
                } else {
                    // Return to original position if invalid drop
                    this.updateShipDisplay();
                }
                
                // Clear tint from all segments in the container
                gameObject.list.forEach(child => {
                    if (child.clearTint) {
                        child.clearTint();
                    }
                });
                this.draggedShip = null;
            }
        });

        // Click on opponent board to shoot
        this.input.on('gameobjectdown', (pointer, gameObject) => {
            console.log('🎯 Click detected:', {
                phase: this.phase,
                isPlayerTurn: this.isPlayerTurn(),
                gameObjectData: {
                    x: gameObject.x,
                    y: gameObject.y,
                    gridX: gameObject.getData('gridX'),
                    gridY: gameObject.getData('gridY')
                }
            });
            
            if (this.phase === 'playing' && this.isPlayerTurn()) {
                const gridPos = this.getGridPosition(gameObject.x, gameObject.y, this.opponentBoard);
                console.log('🎯 Calculated grid position:', gridPos);
                
                if (gridPos && this.isValidShot(gridPos.x, gridPos.y)) {
                    console.log('🎯 Sending shot:', gridPos);
                    this.gameClient.shoot(gridPos.x, gridPos.y);
                } else {
                    console.log('🚫 Invalid shot:', {
                        gridPos,
                        isValid: gridPos ? this.isValidShot(gridPos.x, gridPos.y) : false
                    });
                }
            } else {
                console.log('🚫 Cannot shoot:', {
                    phase: this.phase,
                    isPlayerTurn: this.isPlayerTurn(),
                    expectedPhase: 'playing'
                });
            }
        });
    }

    enterSetupPhase(gameState) {
        this.phase = 'setup';
        this.gameState = gameState;
        
        // Update board size from game state
        if (gameState.boardSize && gameState.boardSize !== this.boardSize) {
            console.log(`🔄 Board size changed from ${this.boardSize} to ${gameState.boardSize}`);
            this.boardSize = gameState.boardSize;
            
            // Clear ALL existing graphics including coordinate labels
            this.clearDynamicGraphics();
            
            // Clear existing boards
            if (this.playerBoard) {
                this.clearBoard(this.playerBoard);
            }
            if (this.opponentBoard) {
                this.clearBoard(this.opponentBoard);
            }
            
            // Recreate boards with new size
            this.createBoards();
        }
        
        this.phaseText.setText('Setup Phase - Place Your Ships');
        this.turnText.setText('Drag ships to your board, right-click to rotate');
        
        this.createShipPieces();
        this.updateShipDisplay();
    }

    enterPlayingPhase(gameState) {
        console.log('🎮 ENTERING PLAYING PHASE!');
        this.phase = 'playing';
        this.gameState = gameState;
        this.phaseText.setText('Battle Phase');
        
        // Enable opponent board for shooting
        console.log('🎯 Enabling opponent board interactions...');
        this.opponentBoard.interactive = true;
        this.makeOpponentBoardInteractive();
        
        this.clearShipPieces();
        this.updateTurnDisplay();
        this.updateBoardDisplay();
        
        console.log('✅ Playing phase setup complete');
    }

    createShipPieces() {
        const player = this.gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
        if (!player) return;

        this.ships = [];
        const startX = 50;
        const startY = 550;
        const horizontalSpacing = 150; // Space between ships horizontally

        player.ships.forEach((ship, index) => {
            // Arrange ships horizontally with proper spacing
            const shipContainer = this.add.container(startX + index * horizontalSpacing, startY);
            
            // Create ship segments horizontally
            for (let i = 0; i < ship.size; i++) {
                const segment = this.add.rectangle(
                    i * 25, 0, 22, 22, 0x4CAF50
                );
                segment.setStrokeStyle(2, 0x333333);
                shipContainer.add(segment);
            }
            
            // Add ship label below the ship
            const label = this.add.text(ship.size * 12.5, 35, `Ship ${ship.size}`, {
                fontSize: '12px',
                fill: '#ffffff'
            }).setOrigin(0.5, 0);
            shipContainer.add(label);
            
            shipContainer.setData('ship', ship);
            // Adjust interaction area for horizontal layout
            shipContainer.setInteractive(new Phaser.Geom.Rectangle(-10, -10, ship.size * 25 + 20, 50), Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(shipContainer);
            
            this.ships.push(shipContainer);
        });
    }

    clearShipPieces() {
        this.ships.forEach(ship => ship.destroy());
        this.ships = [];
    }

    updateShipDisplay() {
        if (!this.gameState) return;
        
        const player = this.gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
        if (!player) return;

        // Clear previous ship displays on player board only (not clearing all graphics)
        this.playerBoard.cells.forEach(row => {
            row.forEach(cell => {
                cell.setFillStyle(0x003366); // Reset to player board color
            });
        });
        
        // Draw placed ships
        player.ships.forEach(ship => {
            if (ship.placed) {
                this.drawShipOnBoard(ship, this.playerBoard, 0x4CAF50);
            }
        });

        // Update ship pieces visibility
        this.ships.forEach((shipContainer, index) => {
            const ship = player.ships[index];
            if (ship && ship.placed) {
                shipContainer.setAlpha(0.3);
                shipContainer.removeInteractive();
            } else {
                shipContainer.setAlpha(1);
                shipContainer.setInteractive();
            }
        });
        
        // Check if all ships are placed
        const allShipsPlaced = player.ships.every(ship => ship.placed);
        if (allShipsPlaced) {
            // Show ready button and update status
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.classList.remove('hidden');
                readyBtn.disabled = false;
                readyBtn.style.backgroundColor = '#4CAF50';
                readyBtn.style.cursor = 'pointer';
            }
            updateGameStatus('All ships placed! Click Ready to start battle.');
        } else {
            // Keep ready button disabled
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.disabled = true;
                readyBtn.style.backgroundColor = '#666666';
                readyBtn.style.cursor = 'not-allowed';
            }
            const shipsToPlace = player.ships.filter(ship => !ship.placed).length;
            updateGameStatus(`Place ${shipsToPlace} more ship${shipsToPlace !== 1 ? 's' : ''} on your board.`);
        }
    }

    updateBoardDisplay() {
        if (!this.gameState) return;
        
        const player = this.gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
        const opponent = this.gameState.players.find(p => p.sessionId !== this.gameClient.room.sessionId);
        
        if (!player || !opponent) return;

        // Clear all previous graphics first
        this.clearDynamicGraphics();
        
        // Reset both boards to original colors
        this.clearBoardShips(this.playerBoard);
        this.clearBoardShips(this.opponentBoard);
        
        // Draw player's ships on their board
        player.ships.forEach(ship => {
            if (ship.placed) {
                this.drawShipOnBoard(ship, this.playerBoard, 0x4CAF50);
            }
        });

        // Update player board with hits
        this.updateBoardHits(this.playerBoard, opponent.hits, opponent.misses);
        
        // Update opponent board with player's shots
        this.updateBoardHits(this.opponentBoard, player.hits, player.misses);
        
        // Show destroyed opponent ships
        opponent.ships.forEach(ship => {
            if (ship.destroyed) {
                this.drawShipOnBoard(ship, this.opponentBoard, 0xff0000);
            }
        });
    }

    updateBoardHits(board, hits, misses) {
        // Show hits
        hits.forEach(hit => {
            const [x, y] = hit.split(',').map(Number);
            if (y >= 0 && y < this.boardSize && x >= 0 && x < this.boardSize) {
                const cell = board.cells[y][x];
                cell.setFillStyle(0xff4444);
                
                // Add hit marker
                const hitMarker = this.add.text(
                    cell.x, cell.y, '🔥', 
                    { fontSize: '16px' }
                ).setOrigin(0.5);
                this.boardMarkers.push(hitMarker);
            }
        });

        // Show misses
        misses.forEach(miss => {
            const [x, y] = miss.split(',').map(Number);
            if (y >= 0 && y < this.boardSize && x >= 0 && x < this.boardSize) {
                const cell = board.cells[y][x];
                cell.setFillStyle(0x666666);
                
                // Add miss marker
                const missMarker = this.add.text(
                    cell.x, cell.y, '💨', 
                    { fontSize: '16px' }
                ).setOrigin(0.5);
                this.boardMarkers.push(missMarker);
            }
        });
    }

    drawShipOnBoard(ship, board, color) {
        for (let i = 0; i < ship.size; i++) {
            let cellX, cellY;
            
            if (ship.orientation === 'horizontal') {
                cellX = ship.x + i;
                cellY = ship.y;
            } else {
                cellX = ship.x;
                cellY = ship.y + i;
            }
            
            if (cellX >= 0 && cellX < this.boardSize && cellY >= 0 && cellY < this.boardSize) {
                const cell = board.cells[cellY][cellX];
                cell.setFillStyle(color);
                
                // Add ship segment marker for destroyed ships
                if (ship.destroyed && ship.hitPositions && ship.hitPositions.includes(i)) {
                    const hitMarker = this.add.text(
                        cell.x, cell.y, '💥', 
                        { fontSize: '16px' }
                    ).setOrigin(0.5);
                    this.boardMarkers.push(hitMarker);
                }
            }
        }
    }

    clearBoardShips(board) {
        // Clear any existing markers and graphics
        this.clearDynamicGraphics();
        
        board.cells.forEach(row => {
            row.forEach(cell => {
                // Reset to original color
                const originalColor = board === this.playerBoard ? 0x003366 : 0x660033;
                cell.setFillStyle(originalColor);
            });
        });
    }

    clearDynamicGraphics() {
        // Clean up all dynamic markers and graphics
        this.boardMarkers.forEach(marker => {
            if (marker && marker.destroy) {
                marker.destroy();
            }
        });
        this.boardMarkers = [];
        
        this.shipGraphics.forEach(graphic => {
            if (graphic && graphic.destroy) {
                graphic.destroy();
            }
        });
        this.shipGraphics = [];
        
        // Clean up coordinate labels
        this.coordinateLabels.forEach(label => {
            if (label && label.destroy) {
                label.destroy();
            }
        });
        this.coordinateLabels = [];
    }

    clearBoard(board) {
        // Clear all cells
        if (board.cells) {
            board.cells.forEach(row => {
                row.forEach(cell => {
                    if (cell && cell.destroy) {
                        cell.destroy();
                    }
                });
            });
        }
        
        // Clear graphics
        if (board.graphics && board.graphics.destroy) {
            board.graphics.destroy();
        }
        
        // Clear title
        if (board.title && board.title.destroy) {
            board.title.destroy();
        }
        
        // Clear container
        if (board.container && board.container.destroy) {
            board.container.destroy();
        }
    }

    makeOpponentBoardInteractive() {
        console.log('🎯 Making opponent board interactive...');
        let cellCount = 0;
        this.opponentBoard.cells.forEach(row => {
            row.forEach(cell => {
                cell.setInteractive();
                cellCount++;
            });
        });
        console.log(`✅ Made ${cellCount} opponent board cells interactive`);
    }

    updateTurnDisplay() {
        if (!this.gameState) return;
        
        const currentPlayer = this.gameState.players.find(p => p.sessionId === this.gameState.currentPlayer);
        if (currentPlayer) {
            if (this.isPlayerTurn()) {
                this.turnText.setText('Your Turn - Click on enemy waters to shoot!');
                this.turnText.setFill('#00ff00');
            } else {
                this.turnText.setText(`${currentPlayer.name}'s Turn - Wait for their move`);
                this.turnText.setFill('#ffff00');
            }
        }
    }

    updateGameState(gameState) {
        this.gameState = gameState;
        
        if (this.phase === 'setup') {
            this.updateShipDisplay();
        } else if (this.phase === 'playing') {
            this.updateTurnDisplay();
            this.updateBoardDisplay();
        }
    }

    getGridPosition(screenX, screenY, board) {
        const boardStartX = 50;
        const boardStartY = 100;
        const boardSpacing = this.boardSize * this.cellSize + 100;
        
        const boardX = board === this.playerBoard ? boardStartX : boardStartX + boardSpacing;
        const boardY = boardStartY;
        
        const gridX = Math.floor((screenX - boardX) / this.cellSize);
        const gridY = Math.floor((screenY - boardY) / this.cellSize);
        
        if (gridX >= 0 && gridX < this.boardSize && gridY >= 0 && gridY < this.boardSize) {
            return { x: gridX, y: gridY };
        }
        
        return null;
    }

    isPlayerTurn() {
        return this.gameState && this.gameState.currentPlayer === this.gameClient.room.sessionId;
    }

    isValidShot(x, y) {
        const player = this.gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
        if (!player) return false;
        
        const shotKey = `${x},${y}`;
        return !player.shots.includes(shotKey);
    }
}
