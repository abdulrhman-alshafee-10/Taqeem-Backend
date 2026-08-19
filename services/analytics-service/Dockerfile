FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/analytics-service ./services/analytics-service

RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

WORKDIR /app/services/analytics-service
RUN npm run build

EXPOSE 4005
CMD ["node", "dist/index.js"]
