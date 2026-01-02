FROM node:18-alpine
WORKDIR /app
COPY backend.js .
EXPOSE 4000
CMD ["node", "backend.js"]
