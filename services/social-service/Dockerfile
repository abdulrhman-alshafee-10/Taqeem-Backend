FROM node:20
WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy shared library
COPY shared ./shared

# Copy social service
COPY services/social-service ./services/social-service

# Install dependencies
RUN npm install

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Build social service
WORKDIR /app/services/social-service
RUN npx prisma generate
RUN npm run build

EXPOSE 4006
CMD ["node", "dist/index.js"]
