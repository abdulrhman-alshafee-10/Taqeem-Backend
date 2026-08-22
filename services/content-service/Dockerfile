FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy feed service
COPY services/feed-service ./services/feed-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build feed service
WORKDIR /app/services/feed-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4013
CMD ["node", "dist/index.js"]
