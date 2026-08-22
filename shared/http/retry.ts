import retry from "async-retry";

/**
 * Retry an async operation with exponential backoff.
 *
 * @param fn The function to retry
 * @param opts Options
 */
export function withRetry<T>(fn: () => Promise<T>, opts: any = {}): Promise<T> {
  return retry(fn, {
    retries:    opts.retries    ?? 3,
    minTimeout: opts.minTimeout ?? 200,    // ms
    maxTimeout: opts.maxTimeout ?? 5_000,  // ms
    factor:     opts.factor     ?? 2,
    randomize:  true,
    onRetry: (err: any, attempt: number) => {
      console.warn(`[retry] attempt ${attempt} after error: ${err.message}`);
    },
    ...opts,
  });
}
