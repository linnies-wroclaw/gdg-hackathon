# BuildWithAI: SolutionSystem Monorepo

This directory contains the Nx-based monorepo for the BuildWithAI TRIZ MCP agent platform. It manages the Angular frontend application, NestJS backend API gateway, and provides references to the ADK agent and python MCP server.

---

## 📂 Monorepo Structure

* **`apps/frontend`**: Angular client app containing the TRIZ Chat Interface. Uses CSS variables mapped to design-system semantic tokens.
* **`apps/api`**: NestJS gateway backend. Receives chat messages, manages sessions, proxies upstream calls to the ADK agent via SSE, and maps response structures.
* **`adg-agents`**: Google Agent Development Kit (ADK) service config using Gemini LLM and MCP toolsets.
* **`mcp-server`**: Python FastMCP server executing TRIZ contradiction matrix searches.
* **`docs`**: Technical specifications and developer plans.

---

## 🛠️ Nx Development Commands

This monorepo uses [Nx](https://nx.dev) to manage tasks, builds, and dependencies.

### Running Development Servers

Run both the NestJS API and Angular frontend concurrently:
```sh
bun run start
```
Or start them individually:

* **Start Backend API only**:
  ```sh
  bun run start:api
  # or: bunx nx serve api
  ```
* **Start Frontend Client only**:
  ```sh
  bun run start:frontend
  # or: bunx nx serve frontend
  ```

### Testing & Linting

Run tests for the whole workspace:
```sh
bun run test
# or individual projects:
bunx nx test api
bunx nx test frontend
```

Lint code in the monorepo:
```sh
bun run lint
# or individual projects:
bunx nx lint api
bunx nx lint frontend
```

### Production Build

Create production bundles for all applications:
```sh
bun run build
# or individual projects:
bunx nx build api
bunx nx build frontend
```

---

## 🐳 Running with Docker

From this folder, you can boot the entire multi-container setup (API gateway, ADK agent, and MCP server):

```bash
docker compose up --build
```

Ensure you have populated the `.env` file in this directory with a valid `GOOGLE_GENAI_API_KEY` before launching Docker.
