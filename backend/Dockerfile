FROM node:20-alpine

WORKDIR /app

# Cache package dependencies layer
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
