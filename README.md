# Battleship Game Online
A multiplayer Battleship Board game built with Colyseus and Phasor

## 🌟 Features
- **Waiting Lobby**: Can create room or join existing room
- **Room option**: room can be public or private with 4-digit passcode
- **Multiple Game Modes**: Multiplayer mode for up to 2 players , every room must have 2 players before game start
- **Interactive Tutorial**: Built-in "How to Play" guide
- **Turn-Based Gameplay**: 
  - Drag all ship into board
  - Ship can rotate 90 degree
  - 14*14 board layout
  - 6 ships in different size
  - opponent players will not see from the start and must guest where you ship is
  - click to bomb part of ship: if player click block on the position that other player place ship, it will bomb that part and if all part of ship bomb so that ship are bombed
  - player will win if bomb all opponent ships
- **Responsive Design**: Works on desktop and mobile devices

## 🌟 Technology Stack

### Frontend
- **Colyseus.js**: Real-time multiplayer client for seamless networking
- **HTML5/CSS3**: Responsive design with modern UI/UX
- **Phasor**: 
- **JavaScript (ES6+)**: Modern vanilla JavaScript with async/await

### Backend  
- **Colyseus**: Authoritative multiplayer game server
- **Node.js**: Server runtime environment
- **Express**: Web server framework
- **@colyseus/schema**: State synchronization

### Data Management
- **JSON Configuration**: Ship data and game settings
- **Real-time State**: Synchronized game state across all clients

## 🎮 How to Play

### Game Setup
1. Show Lobby
2. Choose to create or join existing room
3. When game start, place all your ship into a board then press ready

### Gameplay
1. Guess where your opponent ship is in then click
2. Cannot click the same block on board
3. If player click block on the position that other player place ship, it will show bomb that block,
If not have ship on that block so show empty block (maybe sea)
4. if all part of ship bomb so that ship are bombed 
5. First player that bomb all opponent ship , will wins!

### Multiplayer Features
- Up to 2 players can play together
- Host creates a room and shares the Room ID & Passcode
- Other players join using the Room ID & Passcode
- Real-time synchronization of all game actions

## 🎯 Game Rules

1. **Objective**: First player that bomb all other playser(opponent) ship
2. **Action**: Click on un-reveal block to bomb
3. **Turn Order**: Players alternate turns after Other Player finish click block 
4. **Winning**: First player that bomb all opponent ship , will wins!
5. **Board Layout**: 14*14 sqaure board

## 📝 License

MIT License - Feel free to modify and distribute!
