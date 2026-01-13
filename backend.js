const http = require("http");

function timestamp() {
  return new Date().toISOString();   // Grafana-friendly UTC format
}

http.createServer((req, res) => {
  console.log(`[${timestamp()}] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
  console.log("test")
  res.end("Hello from Backend server02");
}).listen(4000);

console.log(`[${timestamp()}] Backend running on port 4000`);
