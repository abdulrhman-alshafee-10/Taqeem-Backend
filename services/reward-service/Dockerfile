FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy social service
COPY services/reward-service ./services/reward-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build reward service
WORKDIR /app/services/reward-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4014
CMD ["npm", "start"]
