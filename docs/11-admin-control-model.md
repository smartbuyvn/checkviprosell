# Viprosell â€” ADMIN CONTROL MODEL

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## 1. System Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `LOCAL_ONLY_MODE` | boolean | `true` | Block all external AI/render calls |
| `CLOUD_FALLBACK_ENABLED` | boolean | `false` | Allow cloud fallback on local failure |
| `PREMIUM_RENDER_ENABLED` | boolean | `false` | Expose premium cloud render option |
| `ALLOW_EXTERNAL_AI_APIS` | boolean | `false` | Allow external AI providers |
| `LOCAL_LLM_URL` | string | `http://localhost:11434` | Local LLM endpoint |
| `LOCAL_RENDER_WORKER_URL` | string | `http://localhost:5001` | Render worker endpoint |
| `DEFAULT_TTS_MODE` | enum | `local` | `local` or `cloud` |
| `MAX_ASSETS_PER_PROJECT` | number | `8` | Max uploadable assets |
| `DEFAULT_ASPECT_RATIO` | enum | `9:16` | `9:16`, `16:9`, `1:1` |

## 2. Enforcement Rules

| Condition | Enforcement |
|---|---|
| `LOCAL_ONLY_MODE=true` | Backend MUST reject any external AI API call |
| `LOCAL_ONLY_MODE=true` + `ALLOW_EXTERNAL_AI_APIS=true` | **INVALID** â€” validation error |
| `CLOUD_FALLBACK_ENABLED=false` | Local failure = explicit error, no silent fallback |
| `CLOUD_FALLBACK_ENABLED=true` | Requires valid provider config + credentials |
| `PREMIUM_RENDER_ENABLED=false` | Hide from UI AND reject at API |
| `PREMIUM_RENDER_ENABLED=true` + `LOCAL_ONLY_MODE=true` | Only local premium features, no cloud render |
| `ALLOW_EXTERNAL_AI_APIS=false` | No external provider calls anywhere |

## 3. Admin Panel Blocks

### 3.1 AI Policy
- Toggle: LOCAL_ONLY_MODE
- Toggle: CLOUD_FALLBACK_ENABLED
- Toggle: PREMIUM_RENDER_ENABLED
- Toggle: ALLOW_EXTERNAL_AI_APIS

### 3.2 Local Services
- Input: LOCAL_LLM_URL
- Input: LOCAL_RENDER_WORKER_URL
- Select: DEFAULT_TTS_MODE
- Display: health status, last heartbeat, last fail reason

### 3.3 Cloud Providers
- Provider config (name, API key status, allowed features)
- Cost policy and rate limit settings
- Credential validation status

### 3.4 Prompt Control
- CRUD for system prompts
- Versioning (version number, active flag)
- Categories: system, package, campaign, safety

### 3.5 Audit & Ops
- Failed jobs log (filterable by type, date, status)
- Usage dashboard (credits consumed, by user, by project)
- Admin audit log (setting changes with actor, timestamp, old/new values)
- Retry policies per job type

### 3.6 Access Control
- View access matrix (public / authenticated / admin / worker)

## 4. Setting Change Audit

Every setting change must create an `admin_audit_logs` record:
```json
{
  "actor_user_id": "uuid",
  "action": "update_setting",
  "target_type": "system_setting",
  "target_key": "LOCAL_ONLY_MODE",
  "old_value": "true",
  "new_value": "false",
  "created_at": "timestamp"
}
```

## 5. Contradiction Validation

Before saving settings, validate:
1. `LOCAL_ONLY_MODE=true` â†’ `ALLOW_EXTERNAL_AI_APIS` must be `false`
2. `CLOUD_FALLBACK_ENABLED=true` â†’ provider config must exist and be valid
3. `PREMIUM_RENDER_ENABLED=true` + `ALLOW_EXTERNAL_AI_APIS=false` â†’ only local premium, no cloud routes
