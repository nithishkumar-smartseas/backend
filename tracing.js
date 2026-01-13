const { NodeSDK } = require("@opentelemetry/sdk-node");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

const sdk = new NodeSDK({
  serviceName: "backend",
  traceExporter: new OTLPTraceExporter({
    url: "http://172.17.0.1:4318/v1/traces"
  }),
  instrumentations: [new HttpInstrumentation()],
});

sdk.start();
