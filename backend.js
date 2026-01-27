/***********************
 * Tracing
 ***********************/
require("./tracing");

const http = require("http");
const pino = require("pino");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const mariadb = require("mariadb");
const { context, trace } = require("@opentelemetry/api");

/***********************
 * Logger
 ***********************/
const logger = pino({
  base: { service: "backend" },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`,
});

/***********************
 * Trace ID helper
 ***********************/
function getTraceId() {
  const span = trace.getSpan(context.active());
  return span ? span.spanContext().traceId : null;
}

/***********************
 * AWS Cognito config
 ***********************/
const REGION = "us-east-1";
const USER_POOL_ID = "us-east-1_akBTVWhIT";
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

/***********************
 * JWKS client
 ***********************/
const jwks = jwksClient({
  jwksUri: `${ISSUER}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

/***********************
 * Get signing key
 ***********************/
function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/***********************
 * MariaDB (RDS) Connection Pool
 ***********************/
const dbPool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
  connectionLimit: 5,
});

/***********************
 * Authenticate request (JWT REQUIRED)
 ***********************/
function authenticateRequest(req, res, onSuccess) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    res.writeHead(401);
    return res.end("Unauthorized: Missing Authorization header");
  }

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    res.writeHead(401);
    return res.end("Unauthorized: Invalid Authorization format");
  }

  jwt.verify(
    token,
    getKey,
    { issuer: ISSUER, algorithms: ["RS256"] },
    (err, decoded) => {
      if (err) {
        logger.warn(
          { trace_id: getTraceId(), error: err.message },
          "jwt_verification_failed"
        );
        res.writeHead(401);
        return res.end("Unauthorized: Invalid or expired token");
      }
      onSuccess(decoded);
    }
  );
}

/***********************
 * HTTP Server
 ***********************/
http
  .createServer(async (req, res) => {
    const start = Date.now();

    res.on("finish", () => {
      logger.info(
        {
          trace_id: getTraceId(),
          method: req.method,
          path: req.url,
          status: res.statusCode,
          latency_ms: Date.now() - start,
        },
        "http_request"
      );
    });

    // 🔐 JWT + RDS endpoint
    if (req.url === "/backend") {
      return authenticateRequest(req, res, async (user) => {
        let conn;
        try {
          conn = await dbPool.getConnection();

          // Simple DB check query
          const rows = await conn.query("SELECT NOW() AS db_time");

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: "Backend API – JWT verified + RDS connected",
              database_time: rows[0].db_time,
              user: {
                sub: user.sub,
                email: user.email,
              },
              trace_id: getTraceId(),
            })
          );
        } catch (err) {
          logger.error(
            { trace_id: getTraceId(), error: err.message },
            "database_error"
          );
          res.writeHead(500);
          res.end("Database connection failed");
        } finally {
          if (conn) conn.release();
        }
      });
    }

    // ❌ Everything else blocked
    res.writeHead(404);
    res.end("Not Found");
  })
  .listen(4000, "0.0.0.0", () => {
    console.log("✅ Backend listening on 0.0.0.0:4000");
  });

/***********************
 * Startup log
 ***********************/
logger.info({ trace_id: getTraceId(), port: 4000 }, "backend_started");
console.log("Backend running on port 4000");
