import fs from 'fs';
import path from 'path';

const servicesDir = path.join(process.cwd(), 'services');
const services = fs.readdirSync(servicesDir);

for (const service of services) {
  const indexFile = path.join(servicesDir, service, 'src', 'index.ts');
  if (!fs.existsSync(indexFile)) continue;
  
  let content = fs.readFileSync(indexFile, 'utf8');

  // Skip if already patched
  if (content.includes('createHealthRouter')) {
    console.log(`Skipping ${service}: already has healthRouter`);
    continue;
  }

  // Inject imports
  const imports = `import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";\nimport { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";\nimport http from "node:http";\n`;
  content = imports + content;

  // Inject app.use(healthRouter) right before app.listen or at the end of routes
  const healthSetup = `\nconst healthRouter = createHealthRouter("${service}");\napp.use(healthRouter);\n`;
  
  // Find where to insert health setup
  if (content.includes('app.get("/health"')) {
    content = content.replace(/app\.get\("\/health".*?\);/, healthSetup);
  } else {
    content = content.replace('export async function start', healthSetup + '\nexport async function start');
  }

  // Wrap app.listen in http.createServer and register shutdown
  const listenMatch = content.match(/app\.listen\(([^,]+)(.*?)\);/);
  if (listenMatch) {
    const portVar = listenMatch[1];
    const rest = listenMatch[2];
    
    const shutdownSetup = `
  const server = http.createServer(app);
  registerGracefulShutdown(server, { drainMs: 5000 });
  server.listen(${portVar}${rest});`;

    content = content.replace(listenMatch[0], shutdownSetup);
  }

  fs.writeFileSync(indexFile, content, 'utf8');
  console.log(`Patched ${service}`);
}
