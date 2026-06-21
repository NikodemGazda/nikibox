const WebSocket = require('ws');
const ws = new WebSocket('wss://0.peerjs.com/peerjs?key=peerjs&id=nb-TESTXYZ&token=test&version=1.5.5');
ws.on('open', () => console.log('WS OPEN'));
ws.on('error', e => console.error('WS ERR', e.message));
ws.on('close', (code, reason) => console.log('WS CLOSE', code, reason.toString()));
