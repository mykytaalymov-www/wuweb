FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir /data && chown node:node /data
COPY backend ./backend
COPY policies.txt ./policies.txt
USER node
ENV PORT=8787 DATABASE_PATH=/data/orders.sqlite
EXPOSE 8787
CMD ["node", "backend/server.mjs"]
