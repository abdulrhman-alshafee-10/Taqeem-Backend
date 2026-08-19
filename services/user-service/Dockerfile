FROM node:20-alpine
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy user service
COPY services/user-service ./services/user-service

# Install dependencies
RUN npm install

# Build user service
WORKDIR /app/services/user-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4001
CMD ["node", "dist/index.js"]
