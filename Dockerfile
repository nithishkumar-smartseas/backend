FROM public.ecr.aws/docker/library/node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "backend.js"]
EXPOSE 4000