# jsca-dxp
DamExchangeProtocol JavaScript Implementation

DamExchangeProtocol (DXP) is an old protocol (honestly not well-designed) that enables two Draughts computer programs to play one or more draughts games against each other.
While working on https://games.jusoft.cm/, I wanted to test my javascript draughts AI with some very good draughts programs existing that were implementing the DXP protocol to communicate with other programs. I found no javascript library implementing this small protocol and I decided to start one based on this documentation: http://www.mesander.nl/damexchange/edxpmain.htm

Example of Code:

```javascript

const dxp = require('jsca-dxp');
const noop = () => {};

async f() {
  let jscaDxpSocket = new dxp.JscaDxpSocket('127.0.0.1', 27531, {
    onGameReqReceived: noop,
    onGameReqSent: noop,
    onGameAccReceived: noop,
    onGameAccSent: noop,
    onMoveSent: noop,
    onMoveReceived: noop,
    onGameEndReceived: noop,
    onGameEndSent: noop,
    onChat: noop,
    onBackReqReceived: noop,
    onBackReqSent: noop
  });

  await jscaDxpSocket.connect();

  let game = /* Initialise the game */

  await jscaDxpSocket.sendGameRequest('nuggets', (game.isPlayer1White() ? 'W' : 'B'), 3, 75, 'normal');
  jscaDxpSocket.on('move-received', async (move) => {
    game.makeMove(move);

    let myMove = await game.playMyMove();
    if ( myMove ) {
      await jscaDxpSocket.sendMove(0, myMove.from, myMove.to, myMove.takes.length, JSON.parse(JSON.stringify(myMove.takes)));
    } else {
      console.log('Game Over! Loosed !');
      await new Promise((resolve, reject) => { setTimeout(() => { resolve(1); }, 10000) });

      jscaDxpSocket.sendGameEnd(0, 0);
    }
  });

  jscaDxpSocket.on('game-acc-received', async () => {
    if ( game.amITheFirstToPlay() ) {
      let firstmove = /* game. ... */;
      await jscaDxpSocket.sendMove(0, firstMove.from, firstMove.to, firstMove.takes.length, JSON.parse(JSON.stringify(firstMove.takes)));
    }
  });
}

f();

```
