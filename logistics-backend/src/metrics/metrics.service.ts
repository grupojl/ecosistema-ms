import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  increment(key: string, value = 1): void {
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}
