const { NodeSDK } = require("@opentelemetry/sdk-node");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "backend",
  }),
  traceExporter: new OTLPTraceExporter({
    url: "http://172.17.0.1:4318/v1/traces",
  }),
  instrumentations: [new HttpInstrumentation()],
});

sdk.start();
