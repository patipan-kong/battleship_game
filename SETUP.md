# Installation and Setup Guide

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

## Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Client Setup

### Option 1: Using Node.js HTTP Server
1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies (optional):
```bash
npm install
```

3. Start a local HTTP server:
```bash
npm run serve-node
```

### Option 2: Using Python HTTP Server
1. Navigate to the client directory:
```bash
cd client
```

2. Start Python HTTP server:
```bash
python -m http.server 8080
```

### Option 3: Using any HTTP server
Simply serve the client directory contents on any HTTP server.

## Playing the Game

1. Open your browser and navigate to `http://localhost:8080` (or your server URL)
2. Enter your name
3. Create a room or join an existing one
4. Wait for another player to join
5. Place your ships on the board
6. Click "Ready" when all ships are placed
7. Take turns shooting at your opponent's board
8. First player to sink all enemy ships wins!

## Game Controls

### Setup Phase:
- **Drag and Drop**: Place ships on your board
- **Right Click**: Rotate ships 90 degrees
- **Ready Button**: Confirm ship placement

### Battle Phase:
- **Left Click**: Shoot at opponent's board
- **Visual Feedback**: 🔥 for hits, 💨 for misses

## Troubleshooting

### Common Issues:

1. **Server won't start**: Make sure port 3000 is available
2. **Client can't connect**: Check that server is running and firewall settings
3. **Game doesn't load**: Ensure you're accessing via HTTP, not file:// protocol
4. **Players can't join**: Check room ID and passcode for private rooms

### Development Mode:
- Server logs are displayed in the console
- Client errors can be viewed in browser developer tools (F12)

## Architecture

### Server (Colyseus):
- `src/index.js` - Main server entry point
- `src/BattleshipRoom.js` - Game room logic
- `src/schema.js` - Game state schema

### Client (Phaser + HTML):
- `index.html` - Main HTML interface
- `js/GameClient.js` - Colyseus client wrapper
- `js/scenes/GameScene.js` - Phaser game scene
- `js/main.js` - Game utilities and initialization
