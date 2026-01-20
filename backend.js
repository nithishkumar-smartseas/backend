/***********************
 * Tracing 
 ***********************/
require("./tracing");

const http = require("http");
const pino = require("pino");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { context, trace } = require("@opentelemetry/api");

/***********************
 * Logger
 ***********************/
const logger = pino({
  base: {
    service: "backend",
  },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`,
});

/***********************
 * Trace ID helper
 ***********************/
function getTraceId() {
  const span = trace.getSpan(context.active());
  if (!span) return null;
  return span.spanContext().traceId;
}

/***********************
 * AWS Cognito config
 ***********************/
const REGION = "us-east-1";
const USER_POOL_ID = "us-east-1_akBTVWhIT";

const issuer = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

/***********************
 * JWKS client
 ***********************/
const jwks = jwksClient({
  jwksUri: `${issuer}/.well-known/jwks.json`,
});

/***********************
 * Get signing key
 ***********************/
function getKey(header, callback) {
  jwks.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/***********************
 * Authenticate request
 ***********************/
function authenticateRequest(req, res, onSuccess) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    res.writeHead(401);
    res.end("Missing Authorization header");
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.writeHead(401);
    res.end("Invalid Authorization format");
    return;
  }

  const token = parts[1];

  jwt.verify(
    token,
    getKey,
    {
      issuer: issuer,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) {
        logger.warn(
          { trace_id: getTraceId(), error: err.message },
          "jwt_verification_failed"
        );
        res.writeHead(401);
        res.end("Invalid or expired token");
        return;
      }

      onSuccess(decoded);
    }
  );
}

/***********************
 * HTTP Server
 ***********************/
http
  .createServer((req, res) => {
    const start = Date.now();

    res.on("finish", () => {
      logger.info(
        {
          trace_id: getTraceId(),
          method: req.method,
          path: req.url,
          status: res.statusCode,
          latency_ms: Date.now() - start,
          client_ip: req.socket.remoteAddress,
        },
        "http_request"
      );
    });

    // Health / public endpoint
    if (req.url === "/public") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Public API – no authentication required");
      return;
    }

    // Protected endpoint
    if (req.url === "/private") {
      authenticateRequest(req, res, (user) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "Protected API – Cognito JWT verified",
            user: {
              sub: user.sub,
              email: user.email,
            },
            trace_id: getTraceId(),
          })
        );
      });
      return;
    }

    // Default
    res.writeHead(404);
    res.end("Hello from Backend");
  })
  .listen(4000, "0.0.0.0", () => {
  console.log("✅ Backend listening on 0.0.0.0:4000");
});

/***********************
 * Startup logs
 ***********************/
logger.info(
  { trace_id: getTraceId(), port: 4000 },
  "backend_started"
);

console.log("Backend running on port 4000");
console.log("GRAFANA_CLOUD_TOKEN:", process.env.GRAFANA_CLOUD_TOKEN);
