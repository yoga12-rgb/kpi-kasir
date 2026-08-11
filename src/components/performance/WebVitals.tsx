'use client';

import { useReportWebVitals } from 'next/web-vitals';

type WebVital = Parameters<typeof useReportWebVitals>[0] extends (metric: infer Metric) => void
  ? Metric
  : never;

const telemetryEnabled = process.env.NEXT_PUBLIC_PERFORMANCE_TELEMETRY === 'true';

function metricPath(pathname: string) {
  return pathname
    .split('/')
    .map((segment) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return ':id';
      }
      if (/^[A-Za-z0-9_-]{16,}$/.test(segment)) return ':token';
      return segment;
    })
    .join('/');
}

function sendMetric(metric: WebVital) {
  if (!telemetryEnabled || typeof navigator === 'undefined') return;

  const payload = JSON.stringify({
    name: metric.name,
    value: Number(metric.value.toFixed(3)),
    rating: metric.rating,
    navigationType: metric.navigationType,
    path: metricPath(window.location.pathname),
  });
  const body = new Blob([payload], { type: 'application/json' });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/telemetry/web-vitals', body);
    return;
  }

  void fetch('/api/telemetry/web-vitals', {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'content-type': 'application/json' },
  }).catch(() => undefined);
}

export function WebVitals() {
  useReportWebVitals(sendMetric);
  return null;
}
