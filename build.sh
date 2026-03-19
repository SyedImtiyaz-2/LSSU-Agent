#!/usr/bin/env bash
set -o errexit

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Build frontend
cd ../frontend
npm install
npm run build

# Copy frontend build to backend static dir
mkdir -p ../backend/static
cp -r dist/* ../backend/static/
