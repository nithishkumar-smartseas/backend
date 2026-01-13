const { NodeSDK } = require("@opentelemetry/sdk-node");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { trace } = require("@opentelemetry/api");

const sdk = new NodeSDK({
  serviceName: "backend",
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:4318/v1/traces"
  }),
  instrumentations: [new HttpInstrumentation()],
});

sdk.start();