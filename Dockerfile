FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001

CMD ["node", "server/start.js"]
