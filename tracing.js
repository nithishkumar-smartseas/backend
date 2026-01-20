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
    // ✅ Endpoint stays hard-coded (as you requested)
    url: 'https://tempo-prod-us-central-0.grafana.net/otlp/v1/traces',

    // ✅ Token comes from environment variable
    headers: {
      Authorization: `Bearer ${process.env.GRAFANA_CLOUD_TOKEN}`,
    },
  }),

  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log('✅ OpenTelemetry tracing initialized (Grafana Cloud)');
