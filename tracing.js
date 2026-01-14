const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } =
  require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } =
  require("@opentelemetry/exporter-trace-otlp-http");
const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");

const traceExporter = new OTLPTraceExporter({
  // Alloy OTLP HTTP receiver
  url: "http://localhost:4318/v1/traces",
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "backend",
  }),
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start()
  .then(() => {
    console.log("✅ OpenTelemetry tracing initialized");
  })
  .catch((err) => {
    console.error("❌ Error initializing OpenTelemetry", err);
  });
