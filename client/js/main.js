// Phaser Game Configuration and Initialization
// Note: The actual game instance is created by GameClient when needed
// This file only contains utility functions and configuration

// Initialize the client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Battleship Game Client Initialized');
    
    // The game will be created by GameClient when needed
    // This ensures we don't create the Phaser game until we're ready to play
});

// Utility functions for the game
window.GameUtils = {
    // Convert grid coordinates to screen coordinates
    gridToScreen: (gridX, gridY, cellSize, boardStartX, boardStartY) => {
        return {
            x: boardStartX + gridX * cellSize + cellSize / 2,
            y: boardStartY + gridY * cellSize + cellSize / 2
        };
    },

    // Convert screen coordinates to grid coordinates
    screenToGrid: (screenX, screenY, cellSize, boardStartX, boardStartY, boardSize) => {
        const gridX = Math.floor((screenX - boardStartX) / cellSize);
        const gridY = Math.floor((screenY - boardStartY) / cellSize);
        
        if (gridX >= 0 && gridX < boardSize && gridY >= 0 && gridY < boardSize) {
            return { x: gridX, y: gridY };
        }
        
        return null;
    },

    // Check if ship placement is valid
    isValidShipPlacement: (ship, x, y, orientation, boardSize, otherShips) => {
        // Check bounds
        const endX = orientation === 'horizontal' ? x + ship.size - 1 : x;
        const endY = orientation === 'vertical' ? y + ship.size - 1 : y;
        
        if (x < 0 || y < 0 || endX >= boardSize || endY >= boardSize) {
            return false;
        }

        // Check collision with other ships
        const newPositions = [];
        for (let i = 0; i < ship.size; i++) {
            if (orientation === 'horizontal') {
                newPositions.push({ x: x + i, y });
            } else {
                newPositions.push({ x, y: y + i });
            }
        }

        for (const otherShip of otherShips) {
            if (otherShip.id === ship.id || !otherShip.placed) continue;
            
            const otherPositions = GameUtils.getShipPositions(otherShip);
            
            for (const newPos of newPositions) {
                for (const otherPos of otherPositions) {
                    if (newPos.x === otherPos.x && newPos.y === otherPos.y) {
                        return false;
                    }
                }
            }
        }

        return true;
    },

    // Get all positions occupied by a ship
    getShipPositions: (ship) => {
        const positions = [];
        
        for (let i = 0; i < ship.size; i++) {
            if (ship.orientation === 'horizontal') {
                positions.push({ x: ship.x + i, y: ship.y });
            } else {
                positions.push({ x: ship.x, y: ship.y + i });
            }
        }
        
        return positions;
    },

    // Format grid coordinate for display
    formatGridCoordinate: (x, y) => {
        const letter = String.fromCharCode(65 + x);
        const number = y + 1;
        return `${letter}${number}`;
    },

    // Parse grid coordinate from string
    parseGridCoordinate: (coord, boardSize = 14) => {
        if (coord.length < 2) return null;
        
        const letter = coord.charAt(0).toUpperCase();
        const number = parseInt(coord.substring(1));
        
        const x = letter.charCodeAt(0) - 65;
        const y = number - 1;
        
        if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
            return { x, y };
        }
        
        return null;
    },

    // Get ship name by size
    getShipName: (size) => {
        switch (size) {
            case 5: return 'Carrier';
            case 4: return 'Battleship';
            case 3: return 'Cruiser';
            case 2: return 'Destroyer';
            default: return 'Ship';
        }
    },

    // Calculate game statistics
    calculateStats: (player) => {
        const totalShots = player.shots.length;
        const hits = player.hits.length;
        const misses = player.misses.length;
        const accuracy = totalShots > 0 ? Math.round((hits / totalShots) * 100) : 0;
        
        return {
            totalShots,
            hits,
            misses,
            accuracy
        };
    }
};

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gameConfig, GameUtils };
}
