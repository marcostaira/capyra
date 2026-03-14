FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/skills/sap-b1/package*.json ./packages/skills/sap-b1/

RUN npm ci

COPY packages/core ./packages/core
COPY packages/skills/sap-b1 ./packages/skills/sap-b1

RUN npm run build --workspace=@capyra/skill-sap-b1
RUN npm run build --workspace=@capyra/core

WORKDIR /app/packages/core

CMD ["node", "dist/index.js"]