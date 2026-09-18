FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx watch src/index.ts"]
