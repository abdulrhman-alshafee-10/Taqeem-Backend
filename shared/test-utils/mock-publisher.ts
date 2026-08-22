/**
 * Drop-in replacement for shared/events/publisher.ts in test environments.
 * Captures published events for assertion without touching RabbitMQ.
 */
const _events: any[] = [];

export const publishedEvents = () => [..._events];
export const clearEvents = () => _events.splice(0, _events.length);

export async function initPublisher() { /* no-op */ }
export function publishEvent(routingKey: string, payload: any) {
  _events.push({ routingKey, payload, at: Date.now() });
  return Promise.resolve();
}
export async function closePublisher() { /* no-op */ }
