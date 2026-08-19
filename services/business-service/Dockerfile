FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy business service
COPY services/business-service ./services/business-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build business service
WORKDIR /app/services/business-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4002
CMD ["node", "dist/index.js"]
