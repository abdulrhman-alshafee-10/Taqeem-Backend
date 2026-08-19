FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/review-service ./services/review-service

RUN npm install

WORKDIR /app/services/review-service
RUN npm run build

EXPOSE 4003
CMD ["node", "dist/index.js"]
