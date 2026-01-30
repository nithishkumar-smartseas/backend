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
 * AWS Secrets Manager
 ***********************/
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

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
 * Secrets Manager client
 ***********************/
const secretsClient = new SecretsManagerClient({
  region: REGION,
});

async function getDbSecret() {
  const command = new GetSecretValueCommand({
    SecretId: "prod/rds/mariadb",
  });

  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
}

/***********************
 * MariaDB Pool (from Secrets Manager)
 ***********************/
let dbPool;

async function initDbPool() {
  const secret = await getDbSecret();

  dbPool = mariadb.createPool({
    host: secret.host,
    user: secret.username,
    password: secret.password,
    database: secret.dbname,
    port: secret.port || 3306,
    connectionLimit: 5,
  });

  logger.info(
    { trace_id: getTraceId(), host: secret.host },
    "db_pool_initialized_via_secrets_manager"
  );
}

/***********************
 * JWT Authentication
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

    /***********************
     * Health / DB check
     ***********************/
    if (req.url === "/backend") {
      return authenticateRequest(req, res, async (user) => {
        let conn;
        try {
          conn = await dbPool.getConnection();
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

    /***********************
     * Get logged-in user
     ***********************/
    if (req.url === "/users/me") {
      return authenticateRequest(req, res, async (user) => {
        let conn;
        try {
          conn = await dbPool.getConnection();

          const rows = await conn.query(
            "SELECT id, user_id, email, role, created_at FROM users WHERE user_id = ?",
            [user.sub]
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: "User fetched successfully",
              data: rows,
              trace_id: getTraceId(),
            })
          );
        } catch (err) {
          logger.error(
            { trace_id: getTraceId(), error: err.message },
            "user_query_failed"
          );
          res.writeHead(500);
          res.end("Failed to fetch user");
        } finally {
          if (conn) conn.release();
        }
      });
    }

    /***********************
     * Get logged-in user orders
     ***********************/
    if (req.url === "/orders/me") {
      return authenticateRequest(req, res, async (user) => {
        let conn;
        try {
          conn = await dbPool.getConnection();

          const rows = await conn.query(
            "SELECT product_name, amount, status, created_at FROM orders WHERE user_id = ?",
            [user.sub]
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: "Orders fetched successfully",
              data: rows,
              trace_id: getTraceId(),
            })
          );
        } catch (err) {
          logger.error(
            { trace_id: getTraceId(), error: err.message },
            "orders_query_failed"
          );
          res.writeHead(500);
          res.end("Failed to fetch orders");
        } finally {
          if (conn) conn.release();
        }
      });
    }

    /***********************
     * Default
     ***********************/
    res.writeHead(404);
    res.end("Not Found");
  });

/***********************
 * Startup
 ***********************/
(async () => {
  try {
    await initDbPool();

    http.listen(4000, "0.0.0.0", () => {
      console.log("✅ Backend listening on 0.0.0.0:4000");
      logger.info({ trace_id: getTraceId(), port: 4000 }, "backend_started");
    });
  } catch (err) {
    logger.fatal(
      { trace_id: getTraceId(), error: err.message },
      "backend_startup_failed"
    );
    process.exit(1);
  }
})();
