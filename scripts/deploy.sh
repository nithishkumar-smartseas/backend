#!/bin/bash
set -e

echo "Logging in to ECR"
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin 991940085316.dkr.ecr.us-east-1.amazonaws.com

echo "Stopping old container (if exists)"
docker stop backend || true
docker rm backend || true

echo "Pulling new image"
docker pull 991940085316.dkr.ecr.us-east-1.amazonaws.com/backend:latest

echo "Starting container"
docker run -d -p 4000:4000 --name backend 991940085316.dkr.ecr.us-east-1.amazonaws.com/backend:latest
