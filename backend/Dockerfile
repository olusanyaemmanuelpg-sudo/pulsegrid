FROM node:20-alpine

WORKDIR /app

# Cache package dependencies layer
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY --chown=node:node . .

# Run container as non-root user for production security
USER node

EXPOSE 3000

CMD ["node", "server.js"]
