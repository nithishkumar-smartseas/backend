#!/bin/bash
set -e

echo "Logging in to ECR"
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin 991940085316.dkr.ecr.us-east-1.amazonaws.com

echo "Stopping old container (if exists)"
docker stop backend || true
docker rm -f backend || true

echo "Pulling new image"
docker pull 991940085316.dkr.ecr.us-east-1.amazonaws.com/backend:latest

docker run -d --name backend --network app-network --restart unless-stopped 991940085316.dkr.ecr.us-east-1.amazonaws.com/backend:latest

