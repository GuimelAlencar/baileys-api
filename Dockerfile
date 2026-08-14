# ---- Build stage: instala dependencias (precisa de git/compiladores) ----
FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git python3 make g++

COPY package*.json ./
RUN npm install && npm cache clean --force

# ---- Runtime stage: apenas node_modules + codigo, sem ferramentas de build ----
FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY migrations ./migrations
COPY tests ./tests

RUN mkdir -p data auth_info logs

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
