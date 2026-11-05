FROM node:24-alpine AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM dependencies AS build
COPY . .
COPY .env.prod .env
RUN npm run build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=production-dependencies --chown=node:node package.json ./
COPY --from=build --chown=node:node /app/.env ./
COPY --from=build --chown=node:node /app/tsconfig.json ./
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
