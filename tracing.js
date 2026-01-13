const { NodeSDK } = require("@opentelemetry/sdk-node");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { trace } = require("@opentelemetry/api");

const sdk = new NodeSDK({
  serviceName: "backend",
  instrumentations: [new HttpInstrumentation()],
});

sdk.start();