FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/channels/whatsapp/package*.json ./packages/channels/whatsapp/
COPY tsconfig.base.json ./

RUN npm ci --workspace=@capyra/channel-whatsapp

COPY packages/channels/whatsapp ./packages/channels/whatsapp

RUN npm run build --workspace=@capyra/channel-whatsapp

WORKDIR /app/packages/channels/whatsapp

CMD ["node", "dist/index.js"]