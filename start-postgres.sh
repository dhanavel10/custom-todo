#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Checking Docker status..."
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running."
  echo "Please start Docker with: sudo systemctl enable --now docker"
  exit 1
fi

echo "Starting PostgreSQL container via Docker Compose..."
docker compose up -d

echo "Waiting for PostgreSQL to be ready..."
until docker exec todo-postgres pg_isready -U todo_user -d todo_db >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL container is ready!"

echo "Migrating all SQLite data to PostgreSQL..."
cd server && npm run migrate:pg

echo "Restarting backend server..."
cd ..
pkill -f "node server/src/index.js" || true
sleep 1
nohup node server/src/index.js >> backend.log 2>&1 &
sleep 2

tail -n 10 backend.log
echo "Application is now connected to PostgreSQL!"
