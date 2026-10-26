# Local Runtime Truth

This document logs the **physically verified** local runtimes currently existing in the repository. No mocked assumptions are included.

### 1. Frontend Runtime
- **Type**: React SPA (Vite)
- **Port**: `8080` (configured natively).
- **Execution**: `npm run dev`
- **Dependency**: Supabase for Auth routing.

### 2. Backend API Runtime
- **Type**: Fastify REST Server (Node.js)
- **Port**: `3001`
- **Execution**: `npm run backend:dev` (runs `tsx src/server.ts` from `/backend`)
- **Responsibility**: Orchestrates AI queues, verifies Billing/Affiliate webhooks, queries DB with elevated Service bindings.

### 3. Queue Transport Runtime
- **Type**: Redis instance via Docker
- **Port**: `6379`
- **Execution**: `docker-compose -f docker-compose.dev.yml up redis -d`
- **Responsibility**: BullMQ state management.

### 4. Background Workers (x2 Runtimes)
The backend does *not* execute video rendering or heavy LLM extraction synchronously. It offloads to standalone processes.
- **AI Worker**: `npm run worker:ai` (executes `backend/src/ai.worker.ts`). Consumes intelligence prompts.
- **Render Worker**: `npm run worker:render` (executes `backend/src/render.worker.ts`). Consumes final FFmpeg composition sequences.

### 5. Local AI Runtime (Out-of-repo Dependency)
- **Type**: Ollama Host
- **Port**: `11434`
- **Execution**: Run `ollama serve` and `ollama run qwen2.5:7b` externally.

### Missing/Mocked Runtimes (TODO Phase)
- None currently flagged. The `dev:all` command correctly spawns the dual Frontend/Backend tree, leaving isolated terminal boots for workers as the intended standard.
