FROM node:20-alpine
WORKDIR /app
COPY mobile-proxy/package.json ./
RUN npm install --omit=dev
COPY mobile-proxy/server.js ./
ENV NODE_ENV=production
CMD ["node","server.js"]
