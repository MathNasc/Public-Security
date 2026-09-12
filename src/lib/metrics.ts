/**
 * Metrics & Observability Service for Public Security Platform
 * Captures request latency (p50, p90, p95, p99), error rates, throughput, and system health.
 */

export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface EndpointMetric {
  route: string;
  method: string;
  totalRequests: number;
  totalErrors: number;
  statusCodes: Record<number, number>;
  latency: LatencyStats;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  
  // Rolling latency samples (keep last 1,000 requests per endpoint to avoid memory leaks)
  private readonly MAX_SAMPLES = 1000;
  private readonly samples: Map<string, number[]> = new Map();
  private readonly statusCounts: Map<string, Record<number, number>> = new Map();
  private readonly errorCounts: Map<string, number> = new Map();
  private readonly requestCounts: Map<string, number> = new Map();
  private readonly startTime = Date.now();

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Records an incoming HTTP request execution
   */
  public recordRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const key = `${method.toUpperCase()} ${this.normalizeRoute(route)}`;
    
    // Total count
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    // Status code count
    const statuses = this.statusCounts.get(key) || {};
    statuses[statusCode] = (statuses[statusCode] || 0) + 1;
    this.statusCounts.set(key, statuses);

    // Error count (4xx and 5xx)
    if (statusCode >= 400) {
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }

    // Latency samples
    const routeSamples = this.samples.get(key) || [];
    routeSamples.push(durationMs);
    if (routeSamples.length > this.MAX_SAMPLES) {
      routeSamples.shift(); // remove oldest
    }
    this.samples.set(key, routeSamples);
  }

  /**
   * Calculates percentile and summary statistics for a numeric array
   */
  private calculateStats(values: number[]): LatencyStats {
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    const getPercentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return Number(sorted[Math.max(0, Math.min(count - 1, index))].toFixed(2));
    };

    return {
      count,
      min: Number(sorted[0].toFixed(2)),
      max: Number(sorted[count - 1].toFixed(2)),
      mean: Number((sum / count).toFixed(2)),
      p50: getPercentile(50),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }

  /**
   * Normalizes URLs to avoid high-cardinality route metric explosion
   */
  private normalizeRoute(route: string): string {
    const [pathOnly] = route.split('?');
    return pathOnly
      .replace(/\/api\/public\/v1\/analysis.*/, '/api/public/v1/analysis')
      .replace(/\/api\/analysis.*/, '/api/analysis')
      .replace(/\/api\/geocode.*/, '/api/geocode')
      .replace(/\/api\/admin\/jobs\/[a-zA-Z0-9_-]+/, '/api/admin/jobs/:id');
  }

  /**
   * Returns global and per-endpoint metrics
   */
  public getMetricsSummary(): {
    uptimeSeconds: number;
    totalRequests: number;
    totalErrors: number;
    overallLatency: LatencyStats;
    endpoints: EndpointMetric[];
  } {
    const allLatencies: number[] = [];
    let totalRequests = 0;
    let totalErrors = 0;
    const endpoints: EndpointMetric[] = [];

    for (const [key, samples] of this.samples.entries()) {
      const [method, route] = key.split(' ');
      allLatencies.push(...samples);
      
      const reqCount = this.requestCounts.get(key) || 0;
      const errCount = this.errorCounts.get(key) || 0;
      totalRequests += reqCount;
      totalErrors += errCount;

      endpoints.push({
        method,
        route,
        totalRequests: reqCount,
        totalErrors: errCount,
        statusCodes: this.statusCounts.get(key) || {},
        latency: this.calculateStats(samples)
      });
    }

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      totalRequests,
      totalErrors,
      overallLatency: this.calculateStats(allLatencies),
      endpoints: endpoints.sort((a, b) => b.totalRequests - a.totalRequests)
    };
  }

  /**
   * Reset metrics (useful for isolated tests)
   */
  public reset(): void {
    this.samples.clear();
    this.statusCounts.clear();
    this.errorCounts.clear();
    this.requestCounts.clear();
  }
}

export const metricsCollector = MetricsCollector.getInstance();
