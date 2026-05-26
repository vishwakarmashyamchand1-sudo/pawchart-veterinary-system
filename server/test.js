const http = require('http');

const data = JSON.stringify({
  transcript: 'My dog has ear scratching and head shaking',
  duration_seconds: 10
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/ai/process-transcript',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk.toString());
  res.on('end', () => console.log('Response:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
