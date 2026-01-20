FROM public.ecr.aws/docker/library/node:18-alpine
WORKDIR /app
ARG GRAFANA_CLOUD_TOKEN
ENV GRAFANA_CLOUD_TOKEN=${GRAFANA_CLOUD_TOKEN}
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "backend.js"]
EXPOSE 4000