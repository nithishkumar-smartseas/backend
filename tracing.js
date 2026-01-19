'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

/**
 * REQUIRED ENV VARS:
 *
 * TEMPO_OTLP_ENDPOINT=https://tempo-prod-us-central-0.grafana.net/otlp/v1/traces
 * GRAFANA_TRACE_AUTH=Basic <base64(username:api_key)>
 */

const traceExporter = new OTLPTraceExporter({
  url: process.env.TEMPO_OTLP_ENDPOINT,

  headers: {
    Authorization: process.env.GRAFANA_TRACE_AUTH,
  },
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'backend',
    'service.environment': process.env.NODE_ENV || 'production',
  }),

  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('✅ OpenTelemetry tracing initialized (Grafana Cloud Tempo)');
