export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Janela deslizante, como a da API (100 req/min). Usamos um limite abaixo do
 * oficial para não disputar a cota com outros sistemas do escritório.
 */
export class SlidingWindowRateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock = systemClock,
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = this.clock.now();
      while (
        this.timestamps.length > 0 &&
        now - this.timestamps[0] >= this.windowMs
      ) {
        this.timestamps.shift();
      }
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
      await this.clock.sleep(this.timestamps[0] + this.windowMs - now);
    }
  }
}
