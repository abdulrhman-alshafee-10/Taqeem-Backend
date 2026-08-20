FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy order service
COPY services/order-service ./services/order-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build order service
WORKDIR /app/services/order-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4011
CMD ["node", "dist/index.js"]
