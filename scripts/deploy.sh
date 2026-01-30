#!/bin/bash
set -e

echo "===== Docker disk usage (before cleanup) ====="
docker system df || true

echo "===== Cleaning unused Docker resources ====="
# Remove stopped containers
docker container prune -f || true

# Remove unused images
docker image prune -af || true

# Remove unused networks
docker network prune -f || true

# Remove unused volumes (safe if you don't store DB data in Docker volumes)
docker volume prune -f || true

echo "===== Docker disk usage (after cleanup) ====="
docker system df || true

echo "Logging in to ECR"
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin 991940085316.dkr.ecr.us-east-1.amazonaws.com

echo "Creating Docker network (if not exists)"
docker network inspect app-network >/dev/null 2>&1 || docker network create app-network

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

echo "===== Deployment completed successfully ====="
