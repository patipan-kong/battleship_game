const { Schema, type, ArraySchema } = require('@colyseus/schema');

class Ship extends Schema {
    constructor() {
        super();
    }
}
type("number")(Ship.prototype, "id");
type("number")(Ship.prototype, "size");
type("string")(Ship.prototype, "orientation"); // "horizontal" or "vertical"
type("number")(Ship.prototype, "x");
type("number")(Ship.prototype, "y");
type("boolean")(Ship.prototype, "placed");
type("boolean")(Ship.prototype, "destroyed");
type(["number"])(Ship.prototype, "hitPositions");

class Player extends Schema {
    constructor() {
        super();
    }
}
type("string")(Player.prototype, "sessionId");
type("string")(Player.prototype, "name");
type("boolean")(Player.prototype, "ready");
type("boolean")(Player.prototype, "isHost");
type([Ship])(Player.prototype, "ships");
type(["string"])(Player.prototype, "shots"); // Array of "x,y" coordinates
type(["string"])(Player.prototype, "hits"); // Array of "x,y" coordinates that hit ships
type(["string"])(Player.prototype, "misses"); // Array of "x,y" coordinates that missed

class BattleshipState extends Schema {
    constructor() {
        super();
    }
}
type("string")(BattleshipState.prototype, "phase"); // "waiting", "setup", "playing", "finished"
type("string")(BattleshipState.prototype, "currentPlayer");
type("string")(BattleshipState.prototype, "winner");
type([Player])(BattleshipState.prototype, "players");
type("number")(BattleshipState.prototype, "boardSize");
type("number")(BattleshipState.prototype, "shipCount");
type("boolean")(BattleshipState.prototype, "isPrivate");
type("string")(BattleshipState.prototype, "passcode");

module.exports = {
    Ship,
    Player,
    BattleshipState
};
