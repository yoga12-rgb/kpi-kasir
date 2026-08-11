type PerformanceFields = Record<string, boolean | number | string | null>;

export function nowMs() {
  return performance.now();
}

export function logServerPerformance(event: string, fields: PerformanceFields) {
  if (process.env.PERFORMANCE_DEBUG !== 'true') return;
  console.info(`[performance] ${event}`, fields);
}
