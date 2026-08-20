FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy payment service
COPY services/payment-service ./services/payment-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build payment service
WORKDIR /app/services/payment-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4009
CMD ["node", "dist/index.js"]
