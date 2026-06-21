const { Peer } = require('peerjs');
const peer = new Peer();
peer.on('open', id => console.log('Connected with ID:', id));
peer.on('error', err => console.error(err));
