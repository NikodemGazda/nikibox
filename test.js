const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('game.js', 'utf8');
console.log(html.includes('newRoomBtn'));
console.log(js.includes('newRoomBtn'));
