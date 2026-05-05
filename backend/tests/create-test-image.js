const fs = require('fs');
const path = require('path');
// Decode base64 test PNG and write as binary
const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const buf = Buffer.from(b64, 'base64');
const outPath = path.join(__dirname, 'test-image.png');
fs.writeFileSync(outPath, buf);
console.log('Test image written to', outPath, '- size:', buf.length, 'bytes');
