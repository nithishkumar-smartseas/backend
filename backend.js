const http = require('http');

http.createServer(function (req, res) {
  res.end('Hello from Backend server02');
}).listen(4000);

console.log('Backend running on port 4000');
