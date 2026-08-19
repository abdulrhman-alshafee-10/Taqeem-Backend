FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/search-service ./services/search-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

WORKDIR /app/services/search-service
RUN npm run build

EXPOSE 4004
CMD ["node", "dist/src/index.js"]
