# ==============================================================================
# BuildWithAI - TRIZ MCP Workspace Shortcuts
# ==============================================================================

# Automatically load and export variables from the root .env file if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

.PHONY: help init install up down logs dev dev-all dev-mcp dev-agent dev-api dev-frontend test lint clean init-deploy-env deploy-gcloud destroy-gcloud

# Default target displays the help menu
help:
	@echo "BuildWithAI TRIZ MCP Workspace Command Menu:"
	@echo "--------------------------------------------------"
	@echo "Setup and Installation:"
	@echo "  make init           - Copy env template to .env files"
	@echo "  make install        - Install npm and python dependencies"
	@echo ""
	@echo "Docker Compose Commands:"
	@echo "  make up             - Build and start all services via Docker Compose"
	@echo "  make down           - Stop all running containers"
	@echo "  make logs           - Stream container logs"
	@echo ""
	@echo "Local Development Commands (No Docker):"
	@echo "  make dev            - Run backend DB/MCP in Docker + frontend, API, and agent locally (live reload)"
	@echo "  make dev-all        - Run frontend and NestJS API gateway concurrently"
	@echo "  make dev-mcp        - Start python FastMCP TRIZ server"
	@echo "  make dev-agent      - Start ADK Agent runner"
	@echo "  make dev-api        - Start NestJS Backend API Gateway"
	@echo "  make dev-frontend   - Start Angular Frontend Client"
	@echo ""
	@echo "Testing and Code Quality:"
	@echo "  make test           - Run backend and frontend unit tests"
	@echo "  make lint           - Lint the monorepo codebase"
	@echo "  make clean          - Remove builds, caches, and node_modules"
	@echo ""
	@echo "Google Cloud Deployment:"
	@echo "  make init-deploy-env - Copy deployment/gcloud/env.example to deployment/gcloud/.env"
	@echo "  make deploy-gcloud   - Deploy the full Docker Compose stack to Google Cloud"
	@echo "  make destroy-gcloud  - Destroy Google Cloud resources created by deploy.sh"
	@echo "--------------------------------------------------"

# Initialize environment configuration files
init:
	@echo "Initializing .env files..."
	@cp -n .env.example .env || true
	@cp -n solution-system/.env.example solution-system/.env || true
	@echo "Done. Please configure your GOOGLE_GENAI_API_KEY in the .env files."

# Install all workspace dependencies
install:
	@echo "Installing monorepo npm dependencies..."
	cd solution-system && npm install
	@echo "Installing python mcp-server dependencies..."
	cd solution-system/mcp-server && uv sync
	@echo "Installing ADK agent dependencies..."
	cd solution-system/adg-agents && npm install
	@echo "All dependencies installed successfully."

# Docker Compose: spin up all services
up:
	docker compose -f solution-system/docker-compose.yml --env-file .env up --build

# Docker Compose: tear down services
down:
	docker compose -f solution-system/docker-compose.yml --env-file .env down

# Docker Compose: follow logs
logs:
	docker compose -f solution-system/docker-compose.yml --env-file .env logs -f

# Spin up DB/MCP in docker and run frontend, API, agent locally with live reload
dev:
	docker compose -f solution-system/docker-compose.yml up -d postgres mcp-server
	@echo "Cleaning up any stale processes on ports 8081, 3000, 4200..."
	@fuser -k 8081/tcp 3000/tcp 4200/tcp 2>/dev/null || true
	npx --yes concurrently --kill-others \
		-n "api,frontend,agent" \
		-c "blue,green,magenta" \
		"cd solution-system && DB_PORT=$(DB_PORT_HOST) npx nx serve api" \
		"cd solution-system && npx nx serve frontend" \
		"cd solution-system/adg-agents && npx adk api_server agent.ts --port 8081 --host 0.0.0.0"

# Start local dev server for both api and frontend
dev-all:
	cd solution-system && npm run start

# Run the python FastMCP server locally
dev-mcp:
	cd solution-system/mcp-server && uv run python app/main.py

# Run the ADK Agent API server locally
dev-agent:
	cd solution-system/adg-agents && npx adk api_server agent.ts --port 8081 --host 0.0.0.0

# Run the NestJS API server locally
dev-api:
	cd solution-system && npx nx serve api

# Run the Angular frontend locally
dev-frontend:
	cd solution-system && npx nx serve frontend

# Run unit tests across NestJS API and Angular projects
test:
	cd solution-system && npm run test

# Lint NestJS API and Angular projects
lint:
	cd solution-system && npm run lint

# Clean build outputs and caches
clean:
	@echo "Cleaning up dist, tmp, and caches..."
	rm -rf solution-system/dist solution-system/tmp solution-system/.nx
	@echo "To delete node_modules run: rm -rf solution-system/node_modules solution-system/adg-agents/node_modules"

# Initialize Google Cloud deployment environment file
init-deploy-env:
	@echo "Initializing Google Cloud deployment env file..."
	@cp -n deployment/gcloud/env.example deployment/gcloud/.env || true
	@echo "Done. Edit deployment/gcloud/.env before running make deploy-gcloud."

# Deploy the complete Docker Compose application to Google Cloud
deploy-gcloud:
	bash deploy.sh --env-file deployment/gcloud/.env

# Destroy Google Cloud resources created by the deployment scripts
destroy-gcloud:
	bash destroy.sh --env-file deployment/gcloud/.env
