#!/bin/bash

# Sako Docker Startup Script
# This script helps you get started with the Dockerized Sako application

set -e

echo "🐳 Sako Docker Startup Script"
echo "=============================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "Creating .env file from template..."
    cat > .env << 'EOF'
# Database Configuration
POSTGRES_DB=sako
POSTGRES_USER=sako
POSTGRES_PASSWORD=sako_password
POSTGRES_PORT=5432

# API Configuration
API_PORT=3001
NODE_ENV=development

# Frontend Configuration
STUDIO_PORT=3000
CLIENT_PORT=5173
VITE_API_URL=http://localhost:3001

# Database URL
DATABASE_URL=postgresql://sako:sako_password@postgres:5432/sako
EOF
    echo "✅ Created .env file"
    echo "⚠️  IMPORTANT: Update POSTGRES_PASSWORD in .env before production use!"
    echo ""
fi

# Stop and remove existing containers if they exist
if docker ps -a --format '{{.Names}}' | grep -qE '^(sako-postgres|sako-api|sako-studio|sako-client)$'; then
    echo "🧹 Cleaning up existing containers..."
    docker-compose down 2>/dev/null || true
    echo ""
fi

# Always build to ensure latest changes are included
echo "🔨 Building Docker images with latest changes..."
echo "This may take a few minutes on first run..."
echo ""
docker-compose up --build -d

# Wait a moment for services to start
sleep 3

# Check service health
echo ""
echo "📊 Service Status:"
docker-compose ps

# Display access information
echo ""
echo "✅ Sako is now running!"
echo ""
echo "🌐 Access your applications:"
echo "   • API Documentation: http://localhost:3001/api/docs"
echo "   • Studio (Admin):    http://localhost:3000"
echo "   • Client Portal:     http://localhost:5173"
echo ""
echo "📝 Useful commands:"
echo "   • View logs:         docker-compose logs -f"
echo "   • Stop services:     docker-compose down"
echo "   • Restart services:  docker-compose restart"
echo ""
echo "📖 For more information, see DOCKER_SETUP.md"

