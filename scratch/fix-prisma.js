import fs from 'fs';
import path from 'path';

const servicesDir = path.join(process.cwd(), 'services');
const services = fs.readdirSync(servicesDir);

for (const service of services) {
  const schemaPath = path.join(servicesDir, service, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    let content = fs.readFileSync(schemaPath, 'utf8');
    
    // Check if output is already defined
    if (!content.includes('output')) {
      content = content.replace(
        'provider = "prisma-client-js"',
        'provider = "prisma-client-js"\n  output   = "../node_modules/@prisma/client"'
      );
      fs.writeFileSync(schemaPath, content, 'utf8');
      console.log(`Patched ${service} schema.prisma`);
    } else {
      console.log(`Skipping ${service} schema.prisma (already has output)`);
    }
  }
}
