# Viprosell v1.2 Operational Healthcheck Protocol

Use this matrix to verify component stability during local bootstrapping or production staging deployment.

## 1. Supabase Connectivity
- **Target:** Remote Postgres Database & Auth API
- **Command:** `curl -s https://[remote-ref].supabase.co/rest/v1/`
- **Success Criteria:** Verify the remote project is accessible and active.
- **Troubleshoot:** Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` point to a functionally live Supabase cloud project.

## 2. Redis Inter-Process Cache (BullMQ)
- **Target:** Redis v7 Message Broker
- **Command:** `docker exec -it [redis_container_name] redis-cli ping`
- **Success Criteria:** Console returns `PONG`.
- **Troubleshoot:** Verify port `:6379` is open and not blocked by local OS firewalls.

## 3. Fastify Orchestrator & AI Routes
- **Target:** Node 20 API Server
- **Command:** `curl -s http://localhost:3001/health`
- **Success Criteria:** HTTP 200 OK. Returns `{"status":"ok", "service":"viprosell-backend-v1.2"}`.
- **Troubleshoot:** Ensure `npm run backend:dev` is running and `LOVABLE_API_KEY` is present.

## 4. Render Worker (Mocked State)
- **Target:** Node 20 Process simulating Render Queues
- **Command:** `npm run worker:dev` console observation.
- **Success Criteria:** Console outputs mock polling simulation (e.g., "Simulating BullMQ render job...").
- **Troubleshoot:** Ensure backend dependencies are installed. Note that this currently only fakes timeouts and does *not* utilize physical `BullMQ` or `redis` yet.

## 5. FFmpeg Availability
- **Target:** HW Accelerated Encoder
- **Command:** `ffmpeg -version` and `ffmpeg -hwaccels`
- **Success Criteria:** Execution succeeds and `cuda` or `nvenc` is listed under hardware accelerations (if on production/GPU instance).
- **Troubleshoot:** Install NVENC headers or swap to `-c:v libx264` for pure CPU backup testing.

## 6. FaceFusion Premium Worker
- **Target:** Local/Cloud Python Gradio/API Node
- **Command:** `curl -s http://localhost:7860/api/status`
- **Success Criteria:** HTTP 200 OK with `{"execution_providers": ["CUDAExecutionProvider"]}`.
- **Troubleshoot:** Ensure FaceFusion repo is active on port 7860. If `CPUExecutionProvider` is returned, rendering will be unusably slow (~2h/video).
