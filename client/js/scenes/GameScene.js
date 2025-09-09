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
                this.selectedShipContainer = null;
                this.draggedShip = null;
                this.phase = 'waiting';

                // Arrays to track dynamic graphics for cleanup
                this.boardMarkers = [];
                this.shipGraphics = [];
                this.coordinateLabels = [];
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
                    const rowLabel = this.add.text(x - 20, y + i * this.cellSize + this.cellSize / 2, (i + 1).toString(), {
                        fontSize: '12px',
                        fill: '#ffffff'
                    }).setOrigin(0.5);
                    this.coordinateLabels.push(rowLabel);

                    const colLabel = this.add.text(x + i * this.cellSize + this.cellSize / 2, y - 20, String.fromCharCode(65 + i), {
                        fontSize: '12px',
                        fill: '#ffffff'
                    }).setOrigin(0.5);
                    this.coordinateLabels.push(colLabel);
                }

                return board;
            }

            createLabels() {
                this.phaseText = this.add.text(600, 30, 'Waiting for game to start...', {
                    fontSize: '24px',
                    fill: '#ffffff',
                    fontStyle: 'bold'
                }).setOrigin(0.5);

                this.turnText = this.add.text(600, 60, '', {
                    fontSize: '18px',
                    fill: '#ffff00'
                }).setOrigin(0.5);
            }

            setupInputEvents() {
                // Right-click to rotate ships (on inventory or placed)
                this.input.on('pointerdown', (pointer, gameObjects) => {
                    if (pointer.rightButtonDown() && this.phase === 'setup') {
                        const shipContainer = gameObjects.find(obj => obj.getData && obj.getData('ship'));
                        if (shipContainer) {
                            const shipData = shipContainer.getData('ship');
                            // Attempt rotation via server (server validates)
                            this.gameClient.rotateShip(shipData.id);
                        }
                    }
                });

                // Drag and drop for ship placement
                this.input.on('dragstart', (pointer, gameObject) => {
                    if (this.phase === 'setup') {
                        this.draggedShip = gameObject.getData('ship');
                        this.selectShipContainer(gameObject);
                        gameObject.list.forEach(child => child.setTint && child.setTint(0xff6666));
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
                            const player = this.gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
                            const orientation = this.draggedShip.orientation || 'horizontal';
                            if (this.isValidPlacementLocal(player, this.draggedShip, dropPoint.x, dropPoint.y, orientation)) {
                                this.gameClient.placeShip(this.draggedShip.id, dropPoint.x, dropPoint.y);
                            } else {
                                this.flashInvalidPlacement(dropPoint.x, dropPoint.y, this.draggedShip.size, orientation);
                                this.returnShipToInventory(gameObject);
                            }
                        } else {
                            this.returnShipToInventory(gameObject);
                        }

                        gameObject.list.forEach(child => child.clearTint && child.clearTint());
                        this.draggedShip = null;
                    }
                });

                // Click on opponent board to shoot
                this.input.on('gameobjectdown', (pointer, gameObject) => {
                    if (this.phase === 'playing' && this.isPlayerTurn()) {
                        const gridPos = this.getGridPosition(gameObject.x, gameObject.y, this.opponentBoard);
                        if (gridPos && this.isValidShot(gridPos.x, gridPos.y)) {
                            this.gameClient.shoot(gridPos.x, gridPos.y);
                        }
                    }
                });

                // Keyboard rotation: 'R' rotates selected inventory ship or placed ship (validated)
                this.input.keyboard.on('keydown-R', () => {
                    if (this.phase !== 'setup' || !this.selectedShipContainer) return;
                    const ship = this.selectedShipContainer.getData('ship');
                    if (!ship) return;

                    const newOrientation = ship.orientation === 'horizontal' ? 'vertical' : 'horizontal';
                    if (ship.placed) {
                        const player = this.gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
                        if (this.isValidPlacementLocal(player, ship, ship.x, ship.y, newOrientation)) {
                            this.gameClient.rotateShip(ship.id);
                        }
                    } else {
                        ship.orientation = newOrientation;
                        this.selectedShipContainer.setData('orientation', newOrientation);
                        this.layoutShipContainer(this.selectedShipContainer);
                    }
                });
            }

            /* Helper UI methods */
            layoutShipContainer(shipContainer) {
                const orientation = shipContainer.getData('orientation') || shipContainer.getData('ship').orientation || 'horizontal';
                let segIndex = 0;
                shipContainer.list.forEach(child => {
                    // skip text labels
                    if (child.type === 'Text') return;
                    if (orientation === 'horizontal') {
                        child.x = segIndex * 25;
                        child.y = 0;
                    } else {
                        child.x = 0;
                        child.y = segIndex * 25;
                    }
                    segIndex++;
                });
            }

            selectShipContainer(container) {
                if (this.selectedShipContainer && this.selectedShipContainer !== container) {
                    this.selectedShipContainer.list.forEach(ch => ch.clearTint && ch.clearTint());
                }
                this.selectedShipContainer = container;
                container.list.forEach(ch => ch.setTint && ch.setTint(0x9999ff));
            }

            returnShipToInventory(gameObject) {
                const origX = gameObject.getData('origX');
                const origY = gameObject.getData('origY');
                if (typeof origX === 'number' && typeof origY === 'number') {
                    this.tweens.add({
                        targets: gameObject,
                        x: origX,
                        y: origY,
                        ease: 'Cubic.easeOut',
                        duration: 350,
                        onComplete: () => this.updateShipDisplay()
                    });
                } else {
                    this.updateShipDisplay();
                }
            }

            /* Create inventory ship pieces for the player's ships */
            createShipPieces(playerShips) {
                // Layout parameters
                const startX = 50;
                const startY = 520;
                const horizontalSpacing = 110;

                playerShips.forEach((ship, index) => {
                    const origX = startX + index * horizontalSpacing;
                    const origY = startY;
                    const shipContainer = this.add.container(origX, origY);

                    // Create ship segments
                    for (let i = 0; i < ship.size; i++) {
                        const segment = this.add.rectangle(i * 25, 0, 22, 22, 0x4CAF50);
                        segment.setStrokeStyle(2, 0x333333);
                        shipContainer.add(segment);
                    }

                    // Store visual orientation and layout
                    shipContainer.setData('orientation', ship.orientation || 'horizontal');
                    this.layoutShipContainer(shipContainer);

                    // Add label
                    const label = this.add.text(ship.size * 12.5, 35, `Ship ${ship.size}`, { fontSize: '12px', fill: '#ffffff' }).setOrigin(0.5, 0);
                    shipContainer.add(label);

                    shipContainer.setData('ship', ship);
                    shipContainer.setData('origX', origX);
                    shipContainer.setData('origY', origY);
                    shipContainer.setData('isReturning', false);

                    shipContainer.on('pointerdown', () => {
                        if (this.phase !== 'setup') return;
                        this.selectShipContainer(shipContainer);
                    });

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
            // Reset container back to its original inventory position so dragged ships are not lost
            const origX = shipContainer.getData('origX');
            const origY = shipContainer.getData('origY');
            if (typeof origX === 'number' && typeof origY === 'number') {
                shipContainer.x = origX;
                shipContainer.y = origY;
            }

            if (ship && ship.placed) {
                shipContainer.setAlpha(0.3);
                shipContainer.removeInteractive();
            } else {
                shipContainer.setAlpha(1);
                shipContainer.setInteractive(new Phaser.Geom.Rectangle(-10, -10, (ship.size * 25) + 20, 50), Phaser.Geom.Rectangle.Contains);
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

    // Called when entering the setup phase
    enterSetupPhase(gameState) {
        this.phase = 'setup';
        this.gameState = gameState;
        // Update board size from state if provided
        if (gameState.boardSize) this.boardSize = gameState.boardSize;

        const player = gameState.players.find(p => p.sessionId === this.gameClient.room.sessionId);
        if (!player) return;

        // Clear existing inventory pieces and recreate
        this.clearShipPieces();
        this.createShipPieces(player.ships || []);
        this.updateShipDisplay();

        // Update UI text
        if (this.phaseText) this.phaseText.setText('Setup: Place your ships');
    }

    // Called when entering the playing phase
    enterPlayingPhase(gameState) {
        this.phase = 'playing';
        this.gameState = gameState;
        // Update board size if provided
        if (gameState.boardSize) this.boardSize = gameState.boardSize;

        // Ensure boards reflect latest state
        this.updateBoardDisplay();
        this.updateTurnDisplay();
        this.makeOpponentBoardInteractive();

        if (this.phaseText) this.phaseText.setText('Battle!');
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

    // Client-side placement validation to mirror server-side checks (bounds + overlap)
    isValidPlacementLocal(player, ship, x, y, orientation) {
        if (!player || !ship) return false;

        const boardSize = this.boardSize;
        const endX = orientation === 'horizontal' ? x + ship.size - 1 : x;
        const endY = orientation === 'vertical' ? y + ship.size - 1 : y;

        // Check bounds
        if (x < 0 || y < 0 || endX >= boardSize || endY >= boardSize) {
            return false;
        }

        // Compute new ship positions
        const newPositions = this.getShipPositionsLocal(ship, x, y, orientation);

        // Check collision with other placed ships
        for (const otherShip of player.ships) {
            if (otherShip.id === ship.id || !otherShip.placed) continue;
            const otherPositions = this.getShipPositionsLocal(otherShip, otherShip.x, otherShip.y, otherShip.orientation);
            for (const np of newPositions) {
                for (const op of otherPositions) {
                    if (np.x === op.x && np.y === op.y) return false;
                }
            }
        }

        return true;
    }

    getShipPositionsLocal(ship, x, y, orientation) {
        const positions = [];
        for (let i = 0; i < ship.size; i++) {
            if (orientation === 'horizontal') {
                positions.push({ x: x + i, y });
            } else {
                positions.push({ x, y: y + i });
            }
        }
        return positions;
    }

    // Briefly flash the target cells red to indicate invalid placement
    flashInvalidPlacement(x, y, size, orientation) {
        const positions = [];
        for (let i = 0; i < size; i++) {
            if (orientation === 'horizontal') positions.push({ x: x + i, y });
            else positions.push({ x, y: y + i });
        }

        const flashed = [];
        positions.forEach(pos => {
            if (pos.x >= 0 && pos.x < this.boardSize && pos.y >= 0 && pos.y < this.boardSize) {
                const cell = this.playerBoard.cells[pos.y][pos.x];
                if (cell) {
                    // store original tint fill color by reading current fill is not easy; just set to red then restore later
                    cell.setFillStyle(0xff4444);
                    flashed.push(cell);
                }
            }
        });

        setTimeout(() => {
            flashed.forEach(cell => {
                cell.setFillStyle(0x003366);
            });
        }, 500);
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
