'use strict';

const net = require('net');
const EventEmitter = require('events');
const util = require('util');
const Buffer = require('buffer').Buffer;
const jscaDxpDebugger = require('debug')('jsca-dxp');

const DEFAULT_DXP_PORT = 27531;

const INITIAL_STATE_INITIATOR = 0;
const INITIAL_STATE_FOLLOWER  = 1;
const GAME_REQ_SENT_STATE     = 2;
const GAME_REQ_RCVD_STATE     = 3;
const GAME_ACC_SENT_STATE     = 4;
const GAME_ACC_RCVD_STATE     = 5;

const OPCODE_GAMEREQ = 'R';
const OPCODE_GAMEACC = 'A';
const OPCODE_MOVE    = 'M';
const OPCODE_GAMEEND = 'E';
const OPCODE_CHAT    = 'C';
const OPCODE_BACKREQ = 'B';
const OPCODE_BACKACC = 'K';

const NORMAL_STARTING_POSITION = 'A';
const CUSTOM_STARTING_POSITION = 'B';

const FOLLOWER_COLOR_WHITE = 'W';
const FOLLOWER_COLOR_BLACK = 'Z';

const GAME_REQ_RCVD_EVENT = 'game-req-received';
const GAME_REQ_SENT_EVENT = 'game-req-sent';
const GAME_ACC_RCVD_EVENT = 'game-acc-received';
const GAME_ACC_SENT_EVENT = 'game-acc-sent';
const MOVE_RCVD_EVENT     = 'move-received';
const MOVE_SENT_EVENT     = 'move-sent';
const GAME_END_RCVD_EVENT = 'game-end-received';
const GAME_END_SENT_EVENT = 'game-end-sent';
const CHAT_MSG_RCVD_EVENT = 'chat-msg-received';
const CHAT_MSG_SENT_EVENT = 'chat-msg-sent';
const BACK_REQ_RCVD_EVENT = 'back-req-received';
const BACK_REQ_SENT_EVENT = 'back-req-sent';

function JscaDxpSocket (ip, port, options) {
  console.log('EventEmitter.call');
  EventEmitter.call(this);

  this.ip = ip;
  this.port = port;

  this.socket = new net.Socket();
  this.initiator = true;
  this.follower = false;

  if ( options && options.initiator === false ) {
    this.initiator = false;
    this.follower = true;
  }

  this.readBuffer = "";
  this.readResolveQueue = [
    /*
      {
      nbytes: 6,
      resolveFunction: () => {}
      }
    */
  ];

  this.stateResolveHash = {
    /*
      0: [ resolveF1(), resolveF2(), ...],
      4: [ resolveFm(), resolveFn(), ...],
    */
  }

  this.socketConnected = false;

  if ( this.initiator ) {
    this.state = INITIAL_STATE_INITIATOR;
  } else {
    this.state = INITIAL_STATE_FOLLOWER;
  }

  this.socket.on('error', () => {
    this.socketConnected = false;
  });

  this.socket.on('close', () => {
    this.socketConnected = false;
  });

  this.socket.on('data', (data) => {
    this.readBuffer += data;
    if ( this.readResolveQueue.length > 0 ) {
      if ( this.readBuffer.length >= this.readResolveQueue[0].nbytes ) {
        let rcved = this.readBuffer.slice(0, this.readResolveQueue[0].nbytes);
        this.readBuffer = this.readBuffer.slice(this.readResolveQueue[0].nbytes);
        this.readResolveQueue[0].resolveFunction(rcved);
        this.readResolveQueue.shift();
      }
    }
  });

  this.on(GAME_REQ_RCVD_EVENT, (gameReq) => {
    jscaDxpDebugger('Game Request received!', gameReq);
  });

  this.on(GAME_REQ_SENT_EVENT, (gameReq) => {
    jscaDxpDebugger('Game Request sent!', gameReq);
  });

  this.on(GAME_ACC_RCVD_EVENT, (gameAcc) => {
    jscaDxpDebugger('Game Acknowlegement received!', gameAcc);
  });

  this.on(GAME_ACC_SENT_EVENT, (gameAcc) => {
    jscaDxpDebugger('Game Acknowledgement sent!', gameAcc);
  });

  this.on(MOVE_SENT_EVENT, (move) => {
    jscaDxpDebugger('Move sent!', move);
  });

  this.on(MOVE_RCVD_EVENT, (move) => {
    jscaDxpDebugger('Move received!', move);
  });

  this.on(GAME_END_RCVD_EVENT, (gameEnd) => {
    jscaDxpDebugger('Game End received!', gameEnd);
  });

  this.on(GAME_END_SENT_EVENT, (gameEnd) => {
    jscaDxpDebugger('Game End sent!', gameEnd);
  });

  this.on(CHAT_MSG_RCVD_EVENT, (chatMsg) => {
    jscaDxpDebugger('Chat message received!', chatMsg);
  });

  this.on(CHAT_MSG_SENT_EVENT, (chatMsg) => {
    jscaDxpDebugger('Chat message sent!', chatMsg);
  });

  this.on(BACK_REQ_RCVD_EVENT, (backReq) => {
    jscaDxpDebugger('Back Request received!', backReq);
  });

  this.on(BACK_REQ_SENT_EVENT, (backReq) => {
    jscaDxpDebugger('Back Request sent!', backReq);
  });

  if ( options ) {
    if ( options.onGameReqReceived ) {
      this.on(GAME_REQ_RCVD_EVENT, options.onGameReqReceived);
    }

    if ( options.onGameReqSent ) {
      this.on(GAME_REQ_SENT_EVENT, options.onGameReqSent);
    }

    if ( options.onGameAccReceived ) {
      this.on(GAME_ACC_RCVD_EVENT, options.onGameAccReceived);
    }

    if ( options.onGameAccSent ) {
      this.on(GAME_ACC_SENT_EVENT, options.onGameAccSent);
    }

    if ( options.onMoveSent ) {
      this.on(MOVE_SENT_EVENT, options.onMoveSent);
    }

    if ( options.onMoveReceived ) {
      this.on(MOVE_RCVD_EVENT, options.onMoveReceived);
    }

    if ( options.onGameEndReceived ) {
      this.on(GAME_END_RCVD_EVENT, options.onGameEndReceived);
    }

    if ( options.onGameEndSent ) {
      this.on(GAME_END_SENT_EVENT, options.onGameEndSent);
    }

    if ( options.onChatMsgReceived ) {
      this.on(CHAT_MSG_RCVD_EVENT, options.onChatMsgReceived);
    }

    if ( options.onChatMsgSent ) {
      this.on(CHAT_MSG_SENT_EVENT, options.onChatMsgSent);
    }

    if ( options.onBackReqMsgReceived ) {
      this.on(BACK_REQ_RCVD_EVENT, options.onBackReqMsgReceived);
    }

    if ( options.onBackReqMsgSent ) {
      this.on(BACK_REQ_SENT_EVENT, options.onBackReqMsgSent);
    }
  }
}

console.log('util.inherits: ');
util.inherits(JscaDxpSocket, EventEmitter);

JscaDxpSocket.prototype.gameReqReceived = function (gameReq) {
  this.emit(GAME_REQ_RCVD_EVENT, gameReq);
};

JscaDxpSocket.prototype.gameReqSent = function (gameReq) {
  console.log('jsca-dxp:gameReqSent: this: ', this, ' - this.emit: ', this.emit);
  this.emit(GAME_REQ_SENT_EVENT, gameReq);
};

JscaDxpSocket.prototype.gameAccReceived = function (gameAcc) {
  this.emit(GAME_ACC_RCVD_EVENT, gameAcc);
};

JscaDxpSocket.prototype.gameAccSent = function (gameAcc) {
  this.emit(GAME_ACC_SENT_EVENT, gameAcc);
};

JscaDxpSocket.prototype.moveReceived = function (move) {
  this.emit(MOVE_RCVD_EVENT, move);
};

JscaDxpSocket.prototype.moveSent = function (move) {
  this.emit(MOVE_SENT_EVENT, move);
};

JscaDxpSocket.prototype.gameEndReceived = function (gameEnd) {
  this.emit(GAME_END_RCVD_EVENT, gameEnd);
};

JscaDxpSocket.prototype.gameEndSent = function (gameEnd) {
  this.emit(GAME_END_SENT_EVENT, gameEnd);
};

JscaDxpSocket.prototype.chatMsgReceived = function (chatMsg) {
  this.emit(CHAT_MSG_RCVD_EVENT, chatMsg);
};

JscaDxpSocket.prototype.chatMsgSent = function (chatMsg) {
  this.emit(CHAT_MSG_SENT_EVENT, chatMsg);
};

JscaDxpSocket.prototype.backReqReceived = function (backReq) {
  this.emit(BACK_REQ_RCVD_EVENT, backReq);
};

JscaDxpSocket.prototype.backReqSent = function (backReq) {
  this.emit(BACK_REQ_SENT_EVENT, backReq);
};

JscaDxpSocket.prototype.readAsync = function (nbytes) {
  return new Promise((resolve, reject) => {
    // jscaDxpDebugger(`readAsync ${nbytes} bytes - readBuffer: ${this.readBuffer}`);
    if ( this.readBuffer && this.readBuffer.length >= nbytes ) {
      let rcved = this.readBuffer.slice(0, nbytes);
      this.readBuffer = this.readBuffer.slice(nbytes);
      // jscaDxpDebugger(`readAsync ${nbytes} bytes - available: ${rcved} - length ${rcved.length}`);
      resolve(rcved);
    } else {
      // jscaDxpDebugger(`readAsync ${nbytes} bytes - readBuffer: ${this.readBuffer}`);
      this.readResolveQueue.push({
        nbytes: nbytes,
        resolveFunction: resolve
      });
    }
  });
}

JscaDxpSocket.prototype.unread = function (str) {
  this.readBuffer = str + this.readBuffer;
}

JscaDxpSocket.prototype.readAllAvailable = function (max) {
  if ( this.readBuffer && this.readBuffer.length >= 0 ) {
    let rcved = this.readBuffer.slice(0, max);
    this.readBuffer = this.readBuffer.slice(max);
    return rcved;
  }

  return '';
}

JscaDxpSocket.prototype.readAndDecodeGameReqMessage = async function () {
  let version = await this.readAsync(2);
  if ( version != '01' ) {
    jscaDxpDebugger('jsca-dxp: error - gamereq - version should be 01 - version: ', version);
    return null;
  }

  let initiatorName = await this.readAsync(32);

  let followerColor = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: gamereq - follower color: ', followerColor);
  if ( followerColor != FOLLOWER_COLOR_BLACK && followerColor != FOLLOWER_COLOR_WHITE ) {
    return null;
  }

  let thinkingTime = await this.readAsync(3);
  jscaDxpDebugger('jsca-dxp: gamereq - thinking time: ', thinkingTime);

  let numberOfMoves = await this.readAsync(3);
  jscaDxpDebugger('jsca-dxp: gamereq - number of moves: ', numberOfMoves);

  let startingPosition = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: gamereq - starting position: ', startingPosition);

  let colorToMoveFirst = null;
  let position = null;

  if ( startingPosition == CUSTOM_STARTING_POSITION ) {
    colorToMoveFirst = await this.readAsync(1);
    position = await this.readAsync(50);
    if ( !position.match(/^[ewzWZ]$/) ) {
      jscaDxpDebugger('jsca-dxp: position should only contains the characters e,w,z,W,Z');
      return null;
    }
  } else if ( startingPosition != NORMAL_STARTING_POSITION ) {
    return null;
  }

  return {
    version: version,
    initiatorName: initiatorName,
    followerColor: followerColor,
    thinkingTime: thinkingTime,
    numberOfMoves: numberOfMoves,
    startingPosition: startingPosition,
    colorToMoveFirst: colorToMoveFirst,
    position: position
  };
}

JscaDxpSocket.prototype.readAndDecodeGameAccMessage = async function () {
  let followerName = await this.readAsync(32);
  jscaDxpDebugger('jsca-dxp: gamereq - follower name: ', followerName);

  let acceptanceCode = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: gameacc - acceptance code: ', acceptanceCode);
  if ( acceptanceCode != '0' && acceptanceCode != '1' && acceptanceCode != '2' &&
       acceptanceCode != '3' ) {
    return null;
  }
  acceptanceCode = parseInt(acceptanceCode);

  return {
    followerName: followerName,
    acceptanceCode: acceptanceCode,
  }
}

JscaDxpSocket.prototype.readAndDecodeMoveMessage = async function () {
  let time = await this.readAsync(4);
  jscaDxpDebugger('jsca-dxp: move - time to generate: ', time);
  time = parseInt(time);
  if ( (!time && time !== 0) || time < 0 ) {
    jscaDxpDebugger('jsca-dxp: move - invalid time to generate');
    return null;
  }

  let fromPiece = await this.readAsync(2);
  jscaDxpDebugger('jsca-dxp: move - from piece: ', fromPiece);
  fromPiece = parseInt(fromPiece);
  if ( !fromPiece || fromPiece < 1 || fromPiece > 50 ) {
    jscaDxpDebugger('jsca-dxp: move - invalid fromPiece');
    return null;
  }

  let toPiece = await this.readAsync(2);
  jscaDxpDebugger('jsca-dxp: move - to piece: ', toPiece);
  toPiece = parseInt(toPiece);
  if ( !toPiece || toPiece < 1 || toPiece > 50 ) {
    jscaDxpDebugger('jsca-dxp: move - invalid toPiece: ', toPiece);
    return null;
  }

  let ncaptured = await this.readAsync(2);
  jscaDxpDebugger('jsca-dxp: move - number of pieces captured: ', ncaptured);
  ncaptured = parseInt(ncaptured);
  if ( (!ncaptured && ncaptured !== 0) || (ncaptured < 0 || ncaptured > 20) ) {
    jscaDxpDebugger('jsca-dxp: move - invalid number of pieces captured: ', ncaptured);
    return null;
  }

  let capturedPieces = [];

  for ( let i = 0; i < ncaptured; i++ ) {
    let capturedPiece = await this.readAsync(2);
    jscaDxpDebugger('jsca-dxp: move - captured piece: ', capturedPiece);
    capturedPiece = parseInt(capturedPiece);
    if ( !capturedPiece || capturedPiece < 1 || capturedPiece > 50 ) {
      jscaDxpDebugger('jsca-dxp: move - invalid capturedPiece: ', capturedPiece);
      return null;
    }

    capturedPieces.push(capturedPiece);
  }

  return {
    time: time,
    from: fromPiece,
    to: toPiece,
    ncaptured: ncaptured,
    capturedPieces: capturedPieces
  }
}

JscaDxpSocket.prototype.readAndDecodeGameEndMessage = async function () {
  let reason = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: gameend - reason: ', reason);
  if ( reason != '0' && reason != '1' && reason != '2' &&
       reason != '3' ) {
    jscaDxpDebugger('jsca-dxp: invalid reason');
    return null;
  }
  reason = parseInt(reason);

  let stopCode = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: gameend - stop code: ', stopCode);
  if ( stopCode != '0' && stopCode != '1' ) {
    jscaDxpDebugger('jsca-dxp: invalid stop code');
    return null;
  }
  stopCode = parseInt(stopCode);

  return {
    reason: reason,
    stopCode: stopCode,
  }
}

JscaDxpSocket.prototype.readAndDecodeLoop = async function () {
  let opcode = null;
  while ( true ) {
    switch ( this.state ) {
    case INITIAL_STATE_FOLLOWER:
      opcode = await this.readAsync(1);
      switch ( opcode ) {
      case OPCODE_GAMEREQ:
        let gameReq = await this.readAndDecodeGameReqMessage();
        if ( !gameReq ) {
          jscaDxpDebugger('jsca-dxp: invalid game request message !');
          return null;
        }

        this.gameReqReceived(gameReq);
        this.setNewState(GAME_REQ_RCVD_STATE);
        break;

      case '\0':
        break;

      default:
        jscaDxpDebugger('jsca-dxp: unexpected operation code in initial state - ', opcode);
        return null;
      };

      break;

    case INITIAL_STATE_INITIATOR:
      jscaDxpDebugger('go into waiting state game req sent');
      await this.waitUntilState(GAME_REQ_SENT_STATE);
      jscaDxpDebugger('get out of waiting state game req sent');
      break;

    case GAME_REQ_RCVD_STATE:
      await this.waitUntilState(GAME_ACC_SENT_STATE);
      break;

    case GAME_REQ_SENT_STATE:
      opcode = await this.readAsync(1);
      jscaDxpDebugger('jsca-dxp: in GAME_REQ_SENT_STATE opcode received: ', opcode);
      switch ( opcode ) {
      case OPCODE_GAMEACC:
        let gameAcc = await this.readAndDecodeGameAccMessage();
        if ( !gameAcc ) {
          jscaDxpDebugger('jsca-dxp: invalid game accept!');
          return null;
        }

        this.gameAccReceived(gameAcc);
        if ( this.readBuffer ) {
          jscaDxpDebugger('jsca-dxp: in GAME_REQ_SENT_STATE  after gameAccReceived() readBuffer: ', this.readBuffer);
        }

        this.setNewState(GAME_ACC_RCVD_STATE);
        break;

      case '\0':
        break;

      default:
        jscaDxpDebugger('jsca-dxp: unexpected operation code in gameReqSent state - ', opcode);
        return null;
      };

      break;

    case GAME_ACC_RCVD_STATE:
    case GAME_ACC_SENT_STATE:
      opcode = await this.readAsync(1);
      jscaDxpDebugger('jsca-dxp: in GAME_ACC_SENT/RCVD_STATE opcode received: ', opcode);

      if ( this.readBuffer ) {
        jscaDxpDebugger('jsca-dxp: in GAME_ACC_RCVD_STATE readBuffer: ', this.readBuffer);
      }

      switch ( opcode ) {
      case OPCODE_MOVE:
        let move = await this.readAndDecodeMoveMessage();
        if ( !move ) {
          jscaDxpDebugger('jsca-dxp: invalid move message received!');
          return null;
        }

        this.moveReceived(move);
        // this.state = GAME_MOVE_RCVD_STATE;
        break;

      case OPCODE_GAMEEND:
        let gameEnd = await this.readAndDecodeGameEndMessage();
        if ( !gameEnd ) {
          jscaDxpDebugger('jsca-dxp: invalid gameEnd message received!');
          return null;
        }

        this.gameEndReceived(gameEnd);
        this.setNewState(INITIAL_STATE_INITIATOR);
        break;

      case OPCODE_BACKREQ:
        let backReq = await this.readAndDecodeBackReqMessage();
        if ( !backReq ) {
          jscaDxpDebugger('jsca-dxp: invalid backReq message invalid !');
          return null;
        }
        this.backReqReceived(backReq);
        break;

      case OPCODE_BACKACC:
        let backAcc = await this.readAndDecodeBackAccMessage();
        if ( !backAcc ) {
          jscaDxpDebugger('jsca-dxp: invalid backAcc message invalid !');
          return null;
        }
        this.backAccReceived(backAcc);
        break;

      case OPCODE_CHAT:
        let msg = this.readAllAvailable(126);
        this.chatMsgReceived(msg);
        break;

      case OPCODE_GAMEACC:
        let gameAcc = await this.readAndDecodeGameAccMessage();
        if ( !gameAcc ) {
          jscaDxpDebugger('jsca-dxp: invalid game accept!');
          return null;
        }

        this.gameAccReceived(gameAcc);
        if ( this.readBuffer ) {
          jscaDxpDebugger('jsca-dxp: in GAME_ACC_RCVD/SENT_STATE  after gameAccReceived() readBuffer: ', this.readBuffer);
        }

        this.setNewState(GAME_ACC_RCVD_STATE);
        break;

      case '\0':
        break;

      default:
        this.unread(opcode);
        break;
      };

      break;

    default:
      break;
    }
  }
}

JscaDxpSocket.prototype.readAndDecodeBackReqMessage = async function () {
  let moveNumber = await this.readAsync(3);
  jscaDxpDebugger('jsca-dxp: backreq message - move number: ', moveNumber);
  moveNumber = parseInt(moveNumber);
  if ( !moveNumber ) {
    jscaDxpDebugger('jsca-dxp: invalid move number');
    return null;
  }

  let colorOnMove = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: backreq message - colorOnMove: ', colorOnMove);
  if ( colorOnMove != 'W' && colorOnMove != 'Z' ) {
    jscaDxpDebugger('jsca-dxp: invalid colorOnMove');
    return null;
  }

  return {
    reason: moveNumber,
    stopCode: colorOnMove,
  }
}

JscaDxpSocket.prototype.readAndDecodeBackAccMessage = async function () {
  let acceptanceCode = await this.readAsync(1);
  jscaDxpDebugger('jsca-dxp: backacc message - acceptanceCode: ', acceptanceCode);
  if ( acceptanceCode != '0' && acceptanceCode != '1' && acceptanceCode != '2' ) {
    jscaDxpDebugger('jsca-dxp: invalid acceptanceCode !');
    return null;
  }

  return {
    acceptanceCode: acceptanceCode
  }
}

JscaDxpSocket.prototype.waitUntilState = function (state) {
  return new Promise((resolve, reject) => {
    if ( this.state === state ) {
      resolve(state);
    } else {
      if ( this.stateResolveHash ) {
        if ( !this.stateResolveHash[state] ) {
          this.stateResolveHash[state] = [];
        }

        this.stateResolveHash[state].push(resolve);
      }
    }
  });
}

JscaDxpSocket.prototype.setNewState = function (state) {
  this.state = state;
  if ( this.stateResolveHash && this.stateResolveHash[state] &&
       this.stateResolveHash[state].length > 0 ) {
    this.stateResolveHash[state][0](state);
    this.stateResolveHash[state].shift();
  }
}

JscaDxpSocket.prototype.connect = function () {
  return new Promise((resolve, reject) => {
    try {
      if ( !this.socketConnected ) {
        this.socket.connect((this.port ? this.port : DEFAULT_DXP_PORT), this.ip, () => {
          jscaDxpDebugger('jsca-dxp: args connect callback: ', ...arguments);

          this.state = INITIAL_STATE_INITIATOR;
          this.socketConnected = true;

          this.readAndDecodeLoop();
          resolve(this);
        });
      } else {
        resolve(this);
      }
    } catch (e) {
      jscaDxpDebugger(`jsca-dxp: an error occured while connecting - ${e}`);
    }
  });
}

JscaDxpSocket.prototype.sendGameRequest = function (initiatorName, serverColor, thinkingTime,
                                                    nMoves, startingPosition, colorToMoveFirst,
                                                    position) {
  // console.trace();
  return new Promise((resolve, reject) => {
    serverColor = getPlayerColor(serverColor);
    if ( !serverColor ) {
      jscaDxpDebugger('jsca-dxp: getPlayerColor not ok');
      return null;
    }

    thinkingTime = leftPadNumber(thinkingTime, 3, 999, 999);
    nMoves = leftPadNumber(nMoves, 3, 0, 999);

    if ( !startingPosition || startingPosition == "normal" ) {
      startingPosition = "A";
    } else if ( startingPosition == 'specific' ) {
      startingPosition = "B";
    } else {
      jscaDxpDebugger('jsca-dxp: startingPosition should have the value "normal" or "specific"');
      return;
    }

    jscaDxpDebugger('jsca-dxp: startingPosition: ', startingPosition);

    if ( startingPosition == "A" ) {
      colorToMoveFirst = "";
      position = "";
    }

    if ( colorToMoveFirst ) {
      colorToMoveFirst = getPlayerColor(colorToMoveFirst);
      if ( !colorToMoveFirst ) {
        jscaDxpDebugger('jsca-dxp: colorToMoveFirst not ok');
        return null;
      }
    }
    jscaDxpDebugger('jsca-dxp: colorToMoveFirst: ', colorToMoveFirst);

    if ( position ) {
      if ( !position.match(/^[ewzWZ]*$/) && !position.match(/^[ewbWB]*$/) ) {
        jscaDxpDebugger('jsca-dxp: position should only contains the characters e,w,[b|z],W,[B|Z]');
        return;
      }

      position = position.replace('b', 'z');
      position = position.replace('B', 'Z');
    }

    jscaDxpDebugger('jsca-dxp: position: ', position);

    try {
      let messageStr = "R01" + rightPadAndCut(initiatorName, 32) + serverColor + thinkingTime +
          nMoves + startingPosition + colorToMoveFirst + position + '\0';
      this.socket.write(
        Buffer.from(messageStr, 'utf-8'),
        0,
        () => {
          let gameReq = {
            version: 1,
            initiatorName: rightPadAndCut(initiatorName, 32),
            followerColor: serverColor,
            thinkingTime: thinkingTime,
            numberOfMoves: nMoves,
            startingPosition: startingPosition,
            colorToMoveFirst: colorToMoveFirst,
            position: position
          };

          this.gameReqSent(gameReq);
          this.setNewState(GAME_REQ_SENT_STATE);
          resolve(gameReq);
        }
      );
      jscaDxpDebugger('messageStr: ', messageStr, ' - length: ', messageStr.length);

    } catch ( e ) {
      jscaDxpDebugger(`jsca-dxp: an error occured while writing on the socket: ${e}`);
      return null;
    }
  });
}

JscaDxpSocket.prototype.sendGameAcc = function (followerName, acceptanceCode) {
  return new Promise((resolve, reject) => {
    acceptanceCode = parseInt(acceptanceCode);
    if ( !acceptanceCode || (acceptanceCode < 0 || acceptanceCode > 3) ) {
      jscaDxpDebugger(`jsca-dxp: sendGameAcc invalid acceptanceCode ${acceptanceCode}`);
      return null;
    }

    try {
      this.socket.write(
        "A" + rightPadAndCut(followerName, 32) + acceptanceCode + '\0',
        0,
        () => {
          let accMsgSent = {
            followerName: rightPadAndCut(followerName, 32),
            acceptanceCode: acceptanceCode,
          };

          this.gameAccSent(accMsgSent);
          this.setNewState(GAME_ACC_SENT_STATE);
          resolve(accMsgSent);
        }
      );
    } catch ( e ) {
      jscaDxpDebugger(`jsca-dxp: an error occured while writing on the socket: ${e}`);
      return null;
    }
  });
}

JscaDxpSocket.prototype.sendMove = function (time, from, to, ncaptured, capturedPieces) {
  return new Promise((resolve, reject) => {
    jscaDxpDebugger('jsca-dxp: sendMove begin');
    time = parseInt(time);
    if ( (!time && time !== 0) || time < 0 || time > 9999 ) {
      jscaDxpDebugger('jsca-dxp: sendMove - invalid time 1');
      return null;
    }
    jscaDxpDebugger('jsca-dxp: sendMove - time:', time);

    from = parseInt(from);
    if ( !from || from < 1 || from > 50 ) {
      jscaDxpDebugger('jsca-dxp: sendMove - invalid from:', from);
      return null;
    }
    jscaDxpDebugger('jsca-dxp: sendMove - from:', from);

    to = parseInt(to);
    if ( !to || to < 1 || to > 50 ) {
      jscaDxpDebugger('jsca-dxp: sendMove - invalid to: ', to);
      return null;
    }
    jscaDxpDebugger('jsca-dxp: sendMove - to: ', to);

    ncaptured = parseInt(ncaptured);
    if ( (!ncaptured && ncaptured !== 0) || (ncaptured < 0 || ncaptured > 20) ) {
      jscaDxpDebugger('jsca-dxp: sendMove - invalid number of pieces captured: ', ncaptured);
      return null;
    }
    jscaDxpDebugger('jsca-dxp: sendMove - number of pieces captured: ', ncaptured);

    let capturedPiecesStr = ""
    for ( let i = 0; i < ncaptured; i++ ) {
      let capturedPiece = parseInt(capturedPieces[i]);
      if ( !capturedPiece || capturedPiece < 1 || capturedPiece > 50 ) {
        jscaDxpDebugger('jsca-dxp: sendMove - invalid capturedPiece: ', capturedPiece);
        return null;
      }
      jscaDxpDebugger('jsca-dxp: sendMove - capturedPiece: ', capturedPiece);

      capturedPiecesStr += leftPadNumber(capturedPiece, 2);
    }

    try {
      this.socket.write(
        "M" + leftPadNumber(time, 4) + leftPadNumber(from, 2) + leftPadNumber(to, 2) +
          leftPadNumber(ncaptured, 2) + capturedPiecesStr + '\0',
        0,
        () => {
          let moveSent = {
            time: leftPadNumber(time, 4),
            from: leftPadNumber(from, 2),
            to: leftPadNumber(to, 2),
            ncaptured: leftPadNumber(ncaptured, 2),
            capturedPieces: capturedPiecesStr
          };

          this.moveSent(moveSent);
          resolve(moveSent);
        }
      );

      jscaDxpDebugger(`jsca-dxp: sendMove() - written`);
    } catch ( e ) {
      jscaDxpDebugger(`jsca-dxp: sendMove() - an error occured while writing on the socket: ${e}`);
      return null;
    }
  });
}

JscaDxpSocket.prototype.sendGameEnd = function (reason, stopCode) {
  return new Promise((resolve, reject) => {
    reason = parseInt(reason);
    if ( (!reason && reason !== 0) || reason < 0 || reason > 3 ) {
      jscaDxpDebugger('jsca-dxp: sendGameEnd - invalid reason:', reason);
      return null;
    }

    stopCode = parseInt(stopCode);
    if ( (!stopCode && stopCode !==0) || (stopCode != 0 && stopCode != 1) ) {
      jscaDxpDebugger('jsca-dxp: sendGameEnd() - invalid stopCode:', stopCode);
      return null;
    }

    try {
      this.socket.write(
        "E" + reason + stopCode + '\0',
        0,
        () => {
          let msgSent = {
            reason: reason,
            stopCode: stopCode
          };
          this.gameEndSent(msgSent);
          resolve(msgSent);
        }
      );
    } catch ( e ) {
      jscaDxpDebugger(`jsca-dxp: sendMove() - an error occured while writing on the socket: ${e}`);
      return null;
    }
  });
}

function rightPadAndCut(s, nchar) {
  let length = 0;
  if ( s ) {
    length = s.length;
  }

  if ( !nchar ) {
    nchar = 32;
  } else {
    nchar = parseInt(nchar);
    if ( !nchar ) {
      jscaDxpDebugger(`jsca-dxp: nchar must be an integer`);
    }
  }

  if ( length >= nchar ) {
    return s.slice(0, nchar);
  }

  let padLength = nchar - length;

  for ( let i = 0; i < padLength; i++ ) {
    s = s + '0';
  }

  return s;
}

function getPlayerColor(color) {
  switch ( color ) {
  case 'W':
  case 'w':
    return 'W';

  case 'B':
  case 'b':
  case 'Z':
  case 'z':
    return 'Z';

  default:
    jscaDxpDebugger('jsca-dxp: color should be "B", "b", "W", "w", "Z" or "z"');
    return null;
  }
}

function leftPadNumber(n, nchar, defaultValue, max) {
  n = parseInt(n);
  nchar = parseInt(nchar);
  defaultValue = parseInt(defaultValue);
  max = parseInt(max);

  if ( !n ) {
    n = defaultValue ? defaultValue : 0;
  }

  if ( !nchar ) {
    nchar = 3;
  }

  let maxOnNChar = '';
  for ( let i = 0; i < nchar; i++ ) {
    maxOnNChar += '9';
  }
  maxOnNChar = parseInt(maxOnNChar);

  if ( !max || max > maxOnNChar ) {
    max = maxOnNChar;
  }

  if ( n > max ) {
    n = max;
  }

  let nStr = '' + n;
  let padLength = nchar - nStr.length;
  let result = '';

  for ( let i = 0; i < padLength; i++ ) {
    result += '0';
  }
  result += nStr;

  return result;
}

exports.JscaDxpSocket = JscaDxpSocket;
