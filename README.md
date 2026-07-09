# How to run the project

## Option 1: Using Makefile (Simplest)

```bash
make init
# Open .env and insert your GOOGLE_GENAI_API_KEY
make up
```

## Option 2: Using raw Docker Compose (If `make` is not installed)

```bash
cp .env.example .env
# Open .env and insert your GOOGLE_GENAI_API_KEY, then:
docker compose -f solution-system/docker-compose.yml --env-file .env up --build
```

# BuildWithAI: TRIZ MCP Agent Platform

BuildWithAI is an intelligent engineering problem-solving platform that uses **TRIZ (Theory of Inventive Problem Solving)** principles to resolve technical contradictions. The system leverages the **Model Context Protocol (MCP)** to expose a rich database of engineering parameters, contradiction matrices, and inventive principles directly to a **Google Gemini-powered agent** running via Google's **Agent Development Kit (ADK)**.

---

## 🏗️ Architecture Overview

The application is structured as a decoupled multi-service system:

```
┌─────────────────────────────────┐
│     Angular Frontend Client     │  (Port 4200)
└────────────────┬────────────────┘
                 │ (HTTP /api/*)
                 ▼
┌─────────────────────────────────┐
│      NestJS Backend Gateway     │  (Port 3000)
└────────────────┬────────────────┘
                 │ (HTTP /run_sse)
                 ▼
┌─────────────────────────────────┐
│      ADK Agent (Gemini LLM)     │  (Port 8081)
└────────────────┬────────────────┘
                 │ (Model Context Protocol / Streamable HTTP)
                 ▼
┌─────────────────────────────────┐
│      Python TRIZ MCP Server     │  (Port 8000)
└─────────────────────────────────┘
```

1. **Angular Frontend**: An elegant, signal-based UI chat interface for engineers to state contradictions.
2. **NestJS Backend Proxy**: A Gateway API that handles user sessions, proxies message events to the ADK agent, and cleans response structures.
3. **ADK Agent**: A TypeScript agent powered by Gemini (`gemini-2.5-flash`) that uses TRIZ MCP tools to reason through engineering challenges.
4. **TRIZ MCP Server**: A FastMCP server built in Python that interfaces with `pytriz` to lookup contradiction parameters and inventive principles.

---

## 📂 Project Structure

```
gdg-hackathon/
├── docs/                      # Project documentation and specifications
│   ├── agent_workflow.md      # Flowchart detailing the agent reasoning and execution flow by releases
│   ├── design_system_guard.md # Technical specification and enforcement pipeline for design tokens
│   ├── evaluation_criteria.md # Hackathon evaluation criteria and milestones
│   ├── hackathon_task.md      # Hackathon task description and inventive challenges (SDGs)
│   ├── problem_statement_canvas.md # Canvas defining Context, Problem, and SDG 14 Alignment
│   ├── release_roadmap.md     # Roadmap of current implemented core and future releases
│   ├── user_story_map.md      # User Story Map, persona, and hackathon releases
│   └── superpowers/
│       ├── specs/             # Specs for Frontend, Proxy, Persistence & TRIZ
│       └── plans/             # Step-by-step developer implementation plans
├── solution-system/           # Main Nx-based Monorepo
│   ├── apps/
│   │   ├── frontend/         # Angular chat frontend
│   │   └── api/              # NestJS proxy gateway backend
│   ├── adg-agents/           # TypeScript ADK agent definition & runner
│   ├── mcp-server/           # Python FastMCP server for TRIZ tools
│   ├── docker-compose.yml    # Orchestrates the entire stack
│   └── package.json          # Monorepo dependencies and helper commands
├── .env                       # Local environment variables (Git ignored)
└── .env.example               # Environment template file
```

---

## 🛠️ Prerequisites

Ensure you have the following installed on your local machine:
* **Node.js** (v20 or higher) & **Bun** (v1.1 or higher)
* **Python** (v3.13 or higher) and **uv** (recommended Python package manager)
* **Docker** & **Docker Compose**
* A **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

---

## ⚙️ Environment Configuration

1. Copy `.env.example` to `.env` at the root and inside `solution-system`:
   ```bash
   cp .env.example .env
   cp .env.example solution-system/.env
   ```

2. Open the `.env` file and insert your Gemini API Key:
   ```env
   GOOGLE_GENAI_API_KEY=AIzaSy...
   ```

---

## 🛠️ Developer Shortcuts (Makefile)

A `Makefile` is provided at the repository root to simplify workspace tasks:

* **Setup & Dependency Installation**:
  ```bash
  make init       # Copy .env.example to .env and solution-system/.env
  make install    # Install all monorepo, python, and ADK agent dependencies
  ```
* **Docker Compose**:
  ```bash
  make up         # Spin up all services via Docker Compose with .env variables loaded
  make down       # Stop and remove containers
  make logs       # Follow container logs
  ```
* **Hybrid Local Development (Highly Recommended)**:
  ```bash
  make dev        # Starts Postgres and TRIZ MCP in Docker, and runs Angular, NestJS API, and ADK Agent locally with live reload
  ```
* **Local Development (No Docker)**:
  ```bash
  make dev-all    # Run frontend + backend gateway concurrently
  make dev-mcp    # Run TRIZ MCP Server
  make dev-agent  # Run ADK Agent
  make dev-api    # Run NestJS API Gateway
  make dev-frontend # Run Angular Frontend
  ```
* **Testing & Linting**:
  ```bash
  make test         # Run all backend and frontend unit tests
  make lint         # Lint the NestJS and Angular applications and check design tokens
  make lint-tokens  # Lint design system tokens strictly (checks SCSS files)
  make clean        # Clean up build outputs and caches
  ```

---

## 🚀 Getting Started

### Option A: Run with Docker Compose (Recommended Setup)

1. Initialize your local configuration:
   ```bash
   make init
   ```
2. Open the `.env` file at the root directory and specify your `GOOGLE_GENAI_API_KEY`.
3. Launch all services:
   ```bash
   make up
   ```

Once all containers are healthy, open your browser and navigate to:
* **Frontend client**: [http://localhost:4200](http://localhost:4200)
* **NestJS API Gateway**: [http://localhost:3000/api](http://localhost:3000/api)
* **ADK Agent Service**: [http://localhost:8081](http://localhost:8081)
* **TRIZ MCP Server**: [http://localhost:8000/mcp](http://localhost:8000/mcp)

---

### Option B: Hybrid Live Reload Development (No-Docker Frontend/API)

If you are styling the UI or debugging API responses, run the heavy background services in Docker while developing the frontend, NestJS API, and agent locally with hot reloading:

1. Initialize and install all dependencies:
   ```bash
   make init
   make install
   ```
2. Ensure `GOOGLE_GENAI_API_KEY` is configured in the `.env` files.
3. Start the hybrid environment:
   ```bash
   make dev
   ```

---

### Option C: Manual Local Development (Individual Services)

#### 1. Start the TRIZ MCP Server

```bash
cd solution-system/mcp-server
uv sync
uv run python app/main.py
```

*Listens on `http://localhost:8000/mcp`*

#### 2. Start the ADK Agent

```bash
cd solution-system/adg-agents
bun install
bunx adk api_server agent.ts --port 8081 --host 0.0.0.0
```

*Listens on `http://localhost:8081`*

#### 3. Start the NestJS Backend Gateway

```bash
cd solution-system
bunx nx serve api
```

*Listens on `http://localhost:3000`*

#### 4. Start the Angular Frontend

```bash
cd solution-system
bunx nx serve frontend
```

*Listens on `http://localhost:4200`*

---

## 🛠️ TRIZ MCP Tool Registry

The Python MCP server registers 6 specialized tools used by the Gemini agent to resolve contradictions:

* `search_parameter`: Find TRIZ engineering parameters (like weight, speed, stability, etc.) matching a query.
* `get_parameter_by_id`: Retrieve the detailed description of a specific engineering parameter (1-39).
* `browse_contradiction_matrix`: Match an improving parameter with a worsening/preserving parameter to find recommended Inventive Principles.
* `search_principle`: Find TRIZ inventive principles (like segmentation, local quality, nesting, etc.) matching a query.
* `get_principle_by_id`: Retrieve description and concrete examples of an inventive principle (1-40).
* `get_random_principles`: Retrieve random principles for inspiration and brainstorming.
