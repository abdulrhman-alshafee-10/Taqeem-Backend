FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy notification service
COPY services/notification-service ./services/notification-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build notification service
WORKDIR /app/services/notification-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4007
CMD ["node", "dist/index.js"]
