#!/bin/bash
set -e

echo "Logging in to ECR"
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin 991940085316.dkr.ecr.us-east-1.amazonaws.com

echo "Creating Docker network (if not exists)"
docker network create app-network || true

echo "Stopping old backend container (if exists)"
docker stop backend || true
docker rm -f backend || true

echo "Pulling latest backend image"
docker pull 991940085316.dkr.ecr.us-east-1.amazonaws.com/backend:latest

echo "Starting backend container (Secrets Manager enabled)"

docker run -d \
  --name backend \
  --network app-network \
  --restart unless-stopped \
  -p 4000:4000 \
  991940085316.dkr.ecr.us-east-1.amazonaws.com/backend:latest

echo "Waiting for backend startup..."
sleep 5

echo "Backend container status:"
docker ps --filter "name=backend"

echo "Stopping old phpMyAdmin container (if exists)"
docker stop phpmyadmin || true
docker rm -f phpmyadmin || true

echo "Pulling phpMyAdmin image"
docker pull phpmyadmin/phpmyadmin:latest

echo "Starting phpMyAdmin container"
docker run -d \
  --name phpmyadmin \
  --network app-network \
  --restart unless-stopped \
  -e PMA_HOST=database-1.c45qa6ocwymj.us-east-1.rds.amazonaws.com \
  -e PMA_PORT=3306 \
  -e PMA_ARBITRARY=1 \
  phpmyadmin/phpmyadmin:latest

echo "Deployment completed"
