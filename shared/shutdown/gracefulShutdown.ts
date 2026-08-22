export function registerGracefulShutdown(server: any, opts: any = {}) {
  const drainMs = opts.drainMs ?? 15_000;
  const closers = opts.closers ?? [];

  async function shutdown(signal: string) {
    console.log(`[shutdown] received ${signal} — starting graceful drain (${drainMs}ms)`);

    // 1. Stop accepting new HTTP connections
    if (server.close) {
      server.close();
    }

    // 2. Wait for drain window
    await new Promise((resolve) => setTimeout(resolve, drainMs));

    // 3. Close all dependencies
    for (const closer of closers) {
      try {
        await closer();
      } catch (err: any) {
        console.error("[shutdown] close error:", err.message);
      }
    }

    console.log("[shutdown] clean exit");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}
