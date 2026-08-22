FROM node:22-alpine AS production
RUN addgroup -S taqeem && adduser -S -G taqeem taqeem
USER taqeem
WORKDIR /app
COPY --chown=taqeem:taqeem . .
RUN npm install --omit=dev
CMD ["npm", "start"]
