# Local Install Step-by-Step

This guide strictly adheres to verified setup steps that function natively on the current repository iteration.

### Prerequisite Assumptions
1. `Node.js 20+` is installed.
2. `Docker Desktop` is running.
3. `Supabase CLI` is available (`npm i -g supabase`).

### Step 1: Clone & Bootstrap Dependencies
Navigate to the root and run the aggregate install script which captures both frontend and backend trees:
```bash
npm run local:bootstrap
```
*Note: This executes `npm install && cd backend && npm install`.*

### Step 2: Environment Mirroring
Duplicate the exact scaffold variable structure to your local runtime:
```bash
cp .env.example .env
cp .env.example backend/.env
```

### Step 3: Local Infrastructure Boot
Start the isolated Redis broker (required for BullMQ):
```bash
docker-compose -f docker-compose.dev.yml up redis -d
```
Start the local Supabase orchestration (Auth, Postgres DB, Edge configs):
```bash
supabase start
```
*After boot, copy the `anon key`, `service_role key`, and `API URL` into your `.env` files.*

### Step 4: Local Runtime Boot
You must run at least two distinct terminals to operate the SaaS loop locally.

**Terminal 1 (Backend & Frontend Proxy):**
```bash
npm run dev:all
```
*(Boots Vite on `:8080` and Fastify on `:3001`)*

**Terminal 2 (AI Processing Worker):**
```bash
npm run worker:ai
```

*(Optional) Terminal 3 (Render Processing Worker):*
Execute explicitly only when initiating physical video exports:
```bash
npm run worker:render
```
