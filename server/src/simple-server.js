const { Server } = require('colyseus');
const { createServer } = require('http');
const express = require('express');

const app = express();
const server = createServer(app);

console.log('Creating Colyseus server...');

const gameServer = new Server({
    server,
});

console.log('Server created, starting to listen...');

const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('<h1>Battleship Server Running!</h1><p>Server is operational.</p>');
});

gameServer.listen(port, () => {
    console.log(`🚢 Battleship game server is running on port ${port}`);
    console.log(`🌐 Visit http://localhost:${port} to test!`);
});

module.exports = { gameServer, app };
