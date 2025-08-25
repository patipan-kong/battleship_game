const { Server } = require('colyseus');
const { createServer } = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const BattleshipRoom = require('./BattleshipRoom');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../../client')));

const server = createServer(app);
const gameServer = new Server({
    server,
});

// Register the Battleship room
gameServer.define('battleship', BattleshipRoom)
    .enableRealtimeListing();

// Simple room registry to track active rooms
const activeRooms = new Map();

// Add room tracking
gameServer.onShutdown(function() {
    console.log('Game server is shutting down...');
});

// API endpoint to get available rooms
app.get('/api/rooms', async (req, res) => {
    try {
        const availableRooms = [];
        
        console.log('=== Room Listing Debug ===');
        console.log(`Active rooms in registry: ${activeRooms.size}`);
        
        // Use our room registry
        activeRooms.forEach((roomInfo, roomId) => {
            console.log(`Room ${roomId}:`, roomInfo);
            
            if (roomInfo.roomName === 'battleship') {
                const metadata = roomInfo.metadata || {};
                const isPublic = !metadata.isPrivate;
                const hasPlayers = roomInfo.clients > 0; // Don't show empty rooms
                const isJoinable = !metadata.locked && roomInfo.clients < roomInfo.maxClients;
                
                console.log(`  → isPublic: ${isPublic}, hasPlayers: ${hasPlayers}, isJoinable: ${isJoinable}`);
                
                if (isPublic && hasPlayers && isJoinable) {
                    availableRooms.push({
                        roomId: roomId,
                        clients: roomInfo.clients,
                        maxClients: roomInfo.maxClients,
                        metadata: {
                            playerCount: metadata.playerCount || roomInfo.clients,
                            maxPlayers: metadata.maxPlayers || roomInfo.maxClients,
                            phase: metadata.phase || 'waiting',
                            locked: metadata.locked || false,
                            isPrivate: metadata.isPrivate || false,
                            shipCount: metadata.shipCount || 4,
                            boardSize: metadata.boardSize || 14
                        },
                        createdAt: roomInfo.createdAt
                    });
                }
            }
        });
        
        console.log(`Returning ${availableRooms.length} public available rooms`);
        res.json(availableRooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper functions to manage room registry
global.registerRoom = function(roomId, roomInfo) {
    activeRooms.set(roomId, roomInfo);
    console.log(`Room registered: ${roomId}`);
};

global.updateRoom = function(roomId, updates) {
    if (activeRooms.has(roomId)) {
        const roomInfo = activeRooms.get(roomId);
        Object.assign(roomInfo, updates);
        activeRooms.set(roomId, roomInfo);
        console.log(`Room updated: ${roomId}`, updates);
    }
};

global.unregisterRoom = function(roomId) {
    if (activeRooms.has(roomId)) {
        activeRooms.delete(roomId);
        console.log(`Room unregistered: ${roomId}`);
    }
};

const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

gameServer.listen(port, () => {
    console.log(`🚢 Battleship game server is running on port ${port}`);
    console.log(`🌐 Visit http://localhost:${port} to play!`);
    console.log(`🔧 API available at http://localhost:${port}/api/rooms`);
});

module.exports = { gameServer, app };
