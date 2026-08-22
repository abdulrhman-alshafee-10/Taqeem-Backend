import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-node";

const SERVICE_NAME    = process.env.OTEL_SERVICE_NAME ?? "unknown-service";
const OTLP_ENDPOINT   = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";
const SAMPLE_RATE     = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG ?? "1.0");

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]:    SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
  }),

  traceExporter: new OTLPTraceExporter({ url: OTLP_ENDPOINT }),

  metricReader: new PeriodicExportingMetricReader({
    exporter:       new OTLPMetricExporter({ url: OTLP_ENDPOINT }),
    exportIntervalMillis: 15_000,
  }),

  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(SAMPLE_RATE),
  }),

  instrumentations: [
    getNodeAutoInstrumentations({
      // Suppress noisy filesystem spans
      "@opentelemetry/instrumentation-fs": { enabled: false },
      // Capture DB statements (disable in prod if sensitive)
      "@opentelemetry/instrumentation-pg": {
        addSqlCommenterCommentToQueries: true,
        enhancedDatabaseReporting: process.env.NODE_ENV !== "production",
      },
      "@opentelemetry/instrumentation-mongoose": {
        dbStatementSerializer: process.env.NODE_ENV !== "production"
          ? (op: any, payload: any) => JSON.stringify(payload)
          : undefined,
      },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on("SIGTERM", () => sdk.shutdown());
