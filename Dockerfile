FROM node:22.17.0-alpine3.22 AS base
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install


FROM base AS production
WORKDIR /app
COPY . .
RUN pnpm run build
EXPOSE 5000
CMD ["node", "dist/main"]



FROM base AS development
WORKDIR /app
EXPOSE 5000
CMD ["pnpm", "run", "start:dev"]