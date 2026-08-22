#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import { connect, close } from "./lib/amqp.js";
import { inspectDLQ } from "./lib/inspect.js";
import { replayBatch } from "./lib/replay.js";

program
  .name("dlq-replay")
  .description("Inspect and replay Taqeem DLQ messages");

program
  .command("inspect")
  .description("List messages currently in the DLQ")
  .option("-n, --limit <n>", "Max messages to inspect", "100")
  .action(async ({ limit }) => {
    await connect();
    const msgs = await inspectDLQ(parseInt(limit));
    console.table(msgs.map(({ messageId, routingKey, queue, reason, count, time }) => ({
      messageId: messageId?.slice(0, 8) || 'unknown',
      routingKey,
      queue,
      reason,
      count,
      time: time ? new Date(time * 1000).toISOString() : 'unknown',
    })));
    await close();
  });

program
  .command("replay")
  .description("Replay messages from the DLQ")
  .option("-n, --limit <n>",    "Number of messages to replay", "10")
  .option("--routing-key <rk>", "Filter by routing key (e.g. review.created)")
  .option("--dry-run",          "Print what would be replayed without publishing", false)
  .action(async ({ limit, routingKey, dryRun }) => {
    await connect();
    let msgs = await inspectDLQ(parseInt(limit));

    if (routingKey) {
      msgs = msgs.filter((m) => m.routingKey === routingKey);
      console.log(`Filtered to ${msgs.length} messages with key "${routingKey}"`);
    }

    if (dryRun) {
      console.log("--- DRY RUN — no messages will be published ---");
    } else {
      console.log(`Replaying ${msgs.length} messages...`);
    }

    await replayBatch(msgs, dryRun);
    await close();
  });

program
  .command("purge")
  .description("Permanently discard all DLQ messages (IRREVERSIBLE)")
  .option("--confirm", "Required flag to prevent accidental purge", false)
  .action(async ({ confirm }) => {
    if (!confirm) {
      console.error("Aborted: pass --confirm to actually purge the DLQ.");
      process.exit(1);
    }
    const { ch } = await import("./lib/amqp.js");
    await connect();
    const result = await ch.purgeQueue(process.env.DLQ_QUEUE || "dlq.events.queue");
    console.log(`Purged ${result.messageCount} messages from DLQ.`);
    await close();
  });

program.parse();
