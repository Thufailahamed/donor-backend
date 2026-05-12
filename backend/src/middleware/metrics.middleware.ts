import { Request, Response, NextFunction } from 'express';

interface RequestMetric {
  timestamp: number;
  duration: number;
  status: number;
  path: string;
}

const metrics: RequestMetric[] = [];
const MAX_METRICS = 10000;

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  const originalEnd = res.end;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
    const metric: RequestMetric = {
      timestamp: Date.now(),
      duration,
      status: res.statusCode,
      path: req.path,
    };
    if (metrics.length >= MAX_METRICS) metrics.shift();
    metrics.push(metric);
    return originalEnd.call(res, chunk, encoding, cb);
  };

  next();
};

export function getMetricsSnapshot() {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const recentMetrics = metrics.filter(m => m.timestamp > oneMinuteAgo);
  const errors = metrics.filter(m => m.status >= 400);

  const avgResponseTimeMs = recentMetrics.length > 0
    ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
    : 0;

  const requestsPerMinute = recentMetrics.length;
  const errorRate = metrics.length > 0 ? errors.length / metrics.length : 0;

  return {
    avgResponseTimeMs: Math.round(avgResponseTimeMs * 100) / 100,
    requestsPerMinute,
    errorRate: Math.round(errorRate * 10000) / 10000,
    totalRequests: metrics.length,
    totalErrors: errors.length,
  };
}
