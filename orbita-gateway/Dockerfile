FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY index.mjs start.mjs ./
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "start.mjs"]
