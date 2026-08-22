FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy content service
COPY services/content-service ./services/content-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build content service
WORKDIR /app/services/content-service
RUN npm run build

EXPOSE 4011
CMD ["node", "dist/index.js"]
