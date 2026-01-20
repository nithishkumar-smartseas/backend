'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'backend',
  }),

  traceExporter: new OTLPTraceExporter({
    // 🔹 Grafana Cloud Tempo OTLP HTTP endpoint
    url: 'https://tempo-prod-us-central-0.grafana.net/otlp/v1/traces',

    // 🔹 Access Policy token (Traces:Write)
    headers: {
      Authorization:
        'Bearer glc_eyJvIjoiMTYzNzQ4MiIsIm4iOiJ0cmFjZXMtdHJhY2VzIiwiayI6InNvQVJiOTE3ckNjUUg0Y3IzMDJNNEgxNCIsIm0iOnsiciI6InVzIn19',
    },
  }),

  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log('✅ OpenTelemetry tracing initialized (Grafana Cloud)');
