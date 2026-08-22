import fs from 'fs';
import path from 'path';

const composePath = path.join(process.cwd(), 'docker-compose.yml');
let content = fs.readFileSync(composePath, 'utf8');

const services = [
  'user-service', 'business-service', 'review-service', 'search-service',
  'analytics-service', 'agent-service', 'reservation-service', 'notification-service',
  'payment-service', 'social-service', 'order-service', 'moderation-service',
  'feed-service', 'reward-service', 'content-service', 'gateway'
];

for (const svc of services) {
  // Find the service definition
  const regex = new RegExp(`  ${svc}:[\\s\\S]*?(?=\n  [a-z]|\\n$)`, 'g');
  content = content.replace(regex, (match) => {
    if (match.includes('healthcheck:')) return match; // already patched

    const portMatch = match.match(/"(\d{4}):\d{4}"/);
    const port = portMatch ? portMatch[1] : (svc === 'gateway' ? '4000' : '4000');

    const healthBlock = `
    stop_grace_period: 30s
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:${port}/readyz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: ${svc === 'user-service' ? '120s' : '20s'}`;
    
    return match + healthBlock;
  });
}

fs.writeFileSync(composePath, content, 'utf8');
console.log('docker-compose.yml patched with healthchecks');
