FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000 DATA_DIR=/data HLS_DIR=/hls
EXPOSE 3000
CMD ["npm", "start"]
