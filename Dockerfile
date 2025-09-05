# --- Fase 1: Builder ---
# Esta fase instala dependências e constrói a aplicação
FROM node:22-alpine AS builder
WORKDIR /app

# Instala o pnpm
RUN npm install -g pnpm

# Copia apenas os ficheiros de manifesto para otimizar o cache do Docker
COPY package.json pnpm-lock.yaml ./

# Instala todas as dependências (incluindo as de desenvolvimento para o build)
RUN pnpm install

# Copia o resto do código-fonte
COPY . .

# Constrói a aplicação para produção, criando a pasta /dist
RUN pnpm run build



FROM node:22-alpine AS production
WORKDIR /app

# Instala o pnpm
RUN npm install -g pnpm

# Copia os ficheiros de manifesto de pacotes
COPY package.json pnpm-lock.yaml ./

# Instala APENAS as dependências de produção
RUN pnpm install --prod

# Copia os artefactos de build (a pasta /dist) da fase 'builder'
COPY --from=builder /app/dist ./dist

EXPOSE 5000

# O comando para iniciar a aplicação em produção
CMD ["pnpm", "run", "start:prod"]