require("./tracing")
const http = require("http");
const pino = require("pino");
const { context, trace } = require("@opentelemetry/api");

const logger = pino({
  base: {
    service: "backend"
  },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`
});

function getTraceId() {
  const span = trace.getSpan(context.active());
  if (!span) return null;
  return span.spanContext().traceId;
}

http.createServer((req, res) => {
  const start = Date.now();

  res.on("finish", () => {
    logger.info({
      trace_id: getTraceId(),
      method: req.method,
      path: req.url,
      status: res.statusCode,
      latency_ms: Date.now() - start,
      client_ip: req.socket.remoteAddress
    }, "http_request");
  });

  res.end("Hello from Backend server02");
}).listen(4000);

logger.info({ trace_id: getTraceId(), port: 4000 }, "backend_started");
