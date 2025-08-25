const { Room } = require('colyseus');
const { ArraySchema } = require('@colyseus/schema');
const { BattleshipState, Player, Ship } = require('./schema');

class BattleshipRoom extends Room {
    maxClients = 2;

    onCreate(options) {
        this.setState(new BattleshipState());
        
        // Initialize ArraySchema fields
        this.state.players = new ArraySchema();
        
        this.state.phase = "waiting";
        this.state.boardSize = options.boardSize || 14;
        this.state.shipCount = options.shipCount || 4;
        this.state.isPrivate = options.isPrivate || false;
        this.state.passcode = options.passcode || "";
        
        // Set room metadata for public room discovery
        this.setMetadata({
            isPrivate: this.state.isPrivate,
            playerCount: 0,
            maxPlayers: this.maxClients,
            phase: this.state.phase,
            locked: false,
            shipCount: this.state.shipCount,
            boardSize: this.state.boardSize
        });
        
        // Make room joinable
        this.setPrivate(this.state.isPrivate);
        
        // Register room in global registry
        if (global.registerRoom) {
            global.registerRoom(this.roomId, {
                roomName: 'battleship',
                clients: 0,
                maxClients: this.maxClients,
                metadata: this.metadata,
                createdAt: new Date(),
                isPrivate: this.state.isPrivate
            });
        }
        
        console.log("Battleship room created", this.roomId, "isPrivate:", this.state.isPrivate, "shipCount:", this.state.shipCount, "boardSize:", this.state.boardSize);

        // Handle messages
        this.onMessage("place_ship", (client, message) => {
            this.handlePlaceShip(client, message);
        });

        this.onMessage("rotate_ship", (client, message) => {
            this.handleRotateShip(client, message);
        });

        this.onMessage("ready", (client) => {
            this.handlePlayerReady(client);
        });

        this.onMessage("shoot", (client, message) => {
            this.handleShoot(client, message);
        });

        this.onMessage("auto_place_ships", (client) => {
            this.handleAutoPlaceShips(client);
        });

        this.onMessage("clear_ships", (client) => {
            this.handleClearShips(client);
        });

        this.onMessage("set_name", (client, message) => {
            this.handleSetName(client, message);
        });
    }

    onJoin(client, options) {
        console.log(`Player ${client.sessionId} joining room ${this.roomId}`);
        
        // Check if room is full
        if (this.state.players.length >= this.maxClients) {
            console.log("Room is full");
            throw new Error("Room is full");
        }
        
        // Check passcode for private rooms
        if (this.state.isPrivate && options.passcode !== this.state.passcode) {
            console.log("Invalid passcode provided");
            throw new Error("Invalid passcode");
        }

        const player = new Player();
        player.sessionId = client.sessionId;
        player.name = options.name || `Player ${this.state.players.length + 1}`;
        player.ready = false;
        player.isHost = this.state.players.length === 0;
        player.ships = new ArraySchema();
        player.shots = new ArraySchema();
        player.hits = new ArraySchema();
        player.misses = new ArraySchema();

        // Initialize ships
        this.initializeShips(player);

        this.state.players.push(player);
        
        // Update room metadata
        this.setMetadata({
            isPrivate: this.state.isPrivate,
            playerCount: this.state.players.length,
            maxPlayers: this.maxClients,
            phase: this.state.phase,
            locked: this.state.players.length >= this.maxClients
        });

        // Update room registry
        if (global.updateRoom) {
            global.updateRoom(this.roomId, {
                clients: this.state.players.length,
                metadata: this.metadata
            });
        }

        console.log(`Player ${client.sessionId} successfully joined. Room now has ${this.state.players.length} players`);
        
        // Start game if we have 2 players
        if (this.state.players.length === 2) {
            console.log(`🎮 GAME STARTING! Changing phase from "${this.state.phase}" to "setup"`);
            
            // Set phase to setup immediately
            this.state.phase = "setup";
            
            // Update metadata
            this.setMetadata({
                isPrivate: this.state.isPrivate,
                playerCount: this.state.players.length,
                maxPlayers: this.maxClients,
                phase: this.state.phase,
                locked: true // Lock room when game starts
            });
            
            // Update registry
            if (global.updateRoom) {
                global.updateRoom(this.roomId, {
                    clients: this.state.players.length,
                    metadata: this.metadata
                });
            }
            
            console.log(`✅ Phase changed to: ${this.state.phase}, Players: ${this.state.players.length}`);
            
            // Force a state update with a slight delay to ensure all clients receive the update
            setTimeout(() => {
                console.log(`📢 Broadcasting game phase change to all clients`);
                this.broadcast('game_phase_changed', { 
                    phase: this.state.phase, 
                    players: this.state.players.length 
                });
            }, 100);
            
        } else {
            console.log(`⏳ Waiting for more players. Current: ${this.state.players.length}, Need: 2`);
        }
    }

    onLeave(client, consented) {
        console.log(`Player ${client.sessionId} left room ${this.roomId}`);
        
        const playerIndex = this.state.players.findIndex(p => p.sessionId === client.sessionId);
        if (playerIndex !== -1) {
            this.state.players.splice(playerIndex, 1);
        }

        // Update room metadata
        this.setMetadata({
            isPrivate: this.state.isPrivate,
            playerCount: this.state.players.length,
            maxPlayers: this.maxClients,
            phase: this.state.phase,
            locked: this.state.players.length >= this.maxClients
        });

        // Update room registry
        if (global.updateRoom) {
            global.updateRoom(this.roomId, {
                clients: this.state.players.length,
                metadata: this.metadata
            });
        }

        // Reset game state if no players left
        if (this.state.players.length === 0) {
            console.log(`Room ${this.roomId} is now empty, disposing...`);
            
            // Use the proper Colyseus method to dispose the room
            // This will trigger onDispose automatically
            setTimeout(() => {
                this.disconnect();
            }, 1000);
        }
    }

    onDispose() {
        console.log(`Room ${this.roomId} disposing...`);
        
        // Unregister room from global registry
        if (global.unregisterRoom) {
            global.unregisterRoom(this.roomId);
        }
    }

    initializeShips(player) {
        // Generate ship sizes based on room configuration
        let shipSizes = [];
        const shipCount = this.state.shipCount;
        
        if (shipCount === 3) {
            shipSizes = [4, 3, 2];
        } else if (shipCount === 4) {
            shipSizes = [5, 4, 3, 2];
        } else if (shipCount === 5) {
            shipSizes = [5, 4, 3, 3, 2];
        } else if (shipCount === 6) {
            shipSizes = [5, 4, 3, 3, 2, 2];
        } else {
            // Default fallback
            shipSizes = [5, 4, 3, 2];
        }
        
        for (let i = 0; i < shipSizes.length; i++) {
            const ship = new Ship();
            ship.id = i;
            ship.size = shipSizes[i];
            ship.orientation = "horizontal";
            ship.x = -1; // Not placed yet
            ship.y = -1;
            ship.placed = false;
            ship.destroyed = false;
            ship.hitPositions = new ArraySchema();
            
            player.ships.push(ship);
        }
    }

    handleSetName(client, message) {
        const player = this.state.players.find(p => p.sessionId === client.sessionId);
        if (player) {
            player.name = message.name;
        }
    }

    handlePlaceShip(client, message) {
        const player = this.state.players.find(p => p.sessionId === client.sessionId);
        if (!player || this.state.phase !== "setup") {
            console.log(`⚠️ Cannot place ship:`, {
                playerFound: !!player,
                currentPhase: this.state.phase,
                expectedPhase: 'setup'
            });
            return;
        }

        const ship = player.ships[message.shipId];
        if (!ship) {
            console.log(`⚠️ Ship not found: shipId=${message.shipId}`);
            return;
        }

        console.log(`🚢 Attempting to place ship ${message.shipId} at (${message.x}, ${message.y})`);

        // Validate placement
        if (this.isValidPlacement(player, ship, message.x, message.y, ship.orientation)) {
            ship.x = message.x;
            ship.y = message.y;
            ship.placed = true;
            console.log(`✅ Ship ${message.shipId} placed successfully at (${message.x}, ${message.y})`);
            
            // Log player's ship placement progress
            const placedShips = player.ships.filter(s => s.placed).length;
            const totalShips = player.ships.length;
            console.log(`📊 Player ${client.sessionId} has placed ${placedShips}/${totalShips} ships`);
        } else {
            console.log(`❌ Invalid placement for ship ${message.shipId} at (${message.x}, ${message.y})`);
        }
    }

    handleRotateShip(client, message) {
        const player = this.state.players.find(p => p.sessionId === client.sessionId);
        if (!player || this.state.phase !== "setup") return;

        const ship = player.ships[message.shipId];
        if (!ship) return;

        const newOrientation = ship.orientation === "horizontal" ? "vertical" : "horizontal";
        
        // Check if rotation is valid at current position
        if (ship.placed && this.isValidPlacement(player, ship, ship.x, ship.y, newOrientation)) {
            ship.orientation = newOrientation;
        } else if (!ship.placed) {
            ship.orientation = newOrientation;
        }
    }

    handlePlayerReady(client) {
        const player = this.state.players.find(p => p.sessionId === client.sessionId);
        if (!player || this.state.phase !== "setup") {
            console.log(`⚠️ Player ${client.sessionId} tried to ready but conditions not met:`, {
                playerFound: !!player,
                currentPhase: this.state.phase
            });
            return;
        }

        // Check if all ships are placed
        const allShipsPlaced = player.ships.every(ship => ship.placed);
        if (!allShipsPlaced) {
            console.log(`⚠️ Player ${client.sessionId} not ready - ships not all placed:`, {
                totalShips: player.ships.length,
                placedShips: player.ships.filter(s => s.placed).length
            });
            return;
        }

        console.log(`✅ Player ${client.sessionId} is ready!`);
        player.ready = true;

        // Start game if both players are ready
        const readyPlayers = this.state.players.filter(p => p.ready);
        console.log(`🎯 Ready check: ${readyPlayers.length}/${this.state.players.length} players ready`);
        
        if (this.state.players.length === 2 && this.state.players.every(p => p.ready)) {
            console.log(`🎮 STARTING BATTLE PHASE! Both players ready.`);
            this.state.phase = "playing";
            this.state.currentPlayer = this.state.players[0].sessionId;
            
            // Broadcast phase change
            this.broadcast('game_phase_changed', { phase: 'playing' });
        }
    }

    handleShoot(client, message) {
        if (this.state.phase !== "playing" || this.state.currentPlayer !== client.sessionId) return;

        const shooter = this.state.players.find(p => p.sessionId === client.sessionId);
        const target = this.state.players.find(p => p.sessionId !== client.sessionId);
        
        if (!shooter || !target) return;

        const shotKey = `${message.x},${message.y}`;
        
        // Check if already shot at this position
        if (shooter.shots.includes(shotKey)) return;

        shooter.shots.push(shotKey);

        // Check if shot hits a ship
        const hit = this.checkHit(target, message.x, message.y);
        
        if (hit.isHit) {
            shooter.hits.push(shotKey);
            hit.ship.hitPositions.push(hit.hitIndex);
            
            // Check if ship is destroyed
            if (hit.ship.hitPositions.length === hit.ship.size) {
                hit.ship.destroyed = true;
            }
            
            // Check if all ships are destroyed (game over)
            if (target.ships.every(ship => ship.destroyed)) {
                this.state.phase = "finished";
                this.state.winner = shooter.sessionId;
                return;
            }
        } else {
            shooter.misses.push(shotKey);
        }

        // Switch turns
        this.switchTurn();
    }

    checkHit(player, x, y) {
        for (const ship of player.ships) {
            if (!ship.placed) continue;
            
            const positions = this.getShipPositions(ship);
            const hitIndex = positions.findIndex(pos => pos.x === x && pos.y === y);
            
            if (hitIndex !== -1) {
                return { isHit: true, ship, hitIndex };
            }
        }
        
        return { isHit: false };
    }

    getShipPositions(ship) {
        const positions = [];
        
        for (let i = 0; i < ship.size; i++) {
            if (ship.orientation === "horizontal") {
                positions.push({ x: ship.x + i, y: ship.y });
            } else {
                positions.push({ x: ship.x, y: ship.y + i });
            }
        }
        
        return positions;
    }

    isValidPlacement(player, ship, x, y, orientation) {
        // Check bounds
        const endX = orientation === "horizontal" ? x + ship.size - 1 : x;
        const endY = orientation === "vertical" ? y + ship.size - 1 : y;
        
        if (x < 0 || y < 0 || endX >= this.state.boardSize || endY >= this.state.boardSize) {
            return false;
        }

        // Check collision with other ships
        const newPositions = [];
        for (let i = 0; i < ship.size; i++) {
            if (orientation === "horizontal") {
                newPositions.push({ x: x + i, y });
            } else {
                newPositions.push({ x, y: y + i });
            }
        }

        for (const otherShip of player.ships) {
            if (otherShip.id === ship.id || !otherShip.placed) continue;
            
            const otherPositions = this.getShipPositions(otherShip);
            
            for (const newPos of newPositions) {
                for (const otherPos of otherPositions) {
                    if (newPos.x === otherPos.x && newPos.y === otherPos.y) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    switchTurn() {
        const currentIndex = this.state.players.findIndex(p => p.sessionId === this.state.currentPlayer);
        const nextIndex = (currentIndex + 1) % this.state.players.length;
        this.state.currentPlayer = this.state.players[nextIndex].sessionId;
    }

    handleAutoPlaceShips(client) {
        const player = this.state.players.find(p => p.sessionId === client.sessionId);
        if (!player || this.state.phase !== "setup") {
            console.log(`⚠️ Cannot auto-place ships: phase=${this.state.phase}, playerFound=${!!player}`);
            return;
        }

        console.log(`🎲 Auto-placing ships for player ${client.sessionId}`);

        // Clear any existing ship placements
        player.ships.forEach(ship => {
            ship.placed = false;
            ship.x = -1;
            ship.y = -1;
        });

        // Auto-place ships randomly
        const attempts = 100;
        let placedShips = 0;

        for (const ship of player.ships) {
            let placed = false;
            for (let attempt = 0; attempt < attempts && !placed; attempt++) {
                const x = Math.floor(Math.random() * this.state.boardSize);
                const y = Math.floor(Math.random() * this.state.boardSize);
                const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";

                ship.orientation = orientation;

                if (this.isValidPlacement(player, ship, x, y, orientation)) {
                    ship.x = x;
                    ship.y = y;
                    ship.placed = true;
                    placed = true;
                    placedShips++;
                    console.log(`✅ Auto-placed ship ${ship.id} (size ${ship.size}) at (${x}, ${y}) ${orientation}`);
                }
            }

            if (!placed) {
                console.log(`⚠️ Failed to auto-place ship ${ship.id} after ${attempts} attempts`);
            }
        }

        console.log(`🎲 Auto-placement complete: ${placedShips}/${player.ships.length} ships placed`);
    }

    handleClearShips(client) {
        const player = this.state.players.find(p => p.sessionId === client.sessionId);
        if (!player || this.state.phase !== "setup") {
            console.log(`⚠️ Cannot clear ships: phase=${this.state.phase}, playerFound=${!!player}`);
            return;
        }

        console.log(`🗑️ Clearing all ships for player ${client.sessionId}`);

        player.ships.forEach(ship => {
            ship.placed = false;
            ship.x = -1;
            ship.y = -1;
        });

        console.log(`✅ All ships cleared for player ${client.sessionId}`);
    }

    onDispose() {
        console.log(`Room ${this.roomId} disposing...`);
    }
}

module.exports = BattleshipRoom;
