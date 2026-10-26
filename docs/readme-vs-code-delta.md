# README vs. Code Delta Report

## Overview
This document logs all deltas between the finalized product vision (README) and the physical codebase constraints. 

### Active Deltas
* **SPA Deployment Configuration:**
  - *README Requirement*: Mentions creating an `.htaccess` file for React Router URL rewrites.
  - *Code Truth*: Missing `public/.htaccess`.
  - *Status*: `[Documented but not implemented]`

* **Premium Cloud Render Gateway:**
  - *README Requirement*: Defined as a fallback option blocked by admin settings.
  - *Code Truth*: Code completely locks via `LOCAL_ONLY_MODE=true` flags natively without external wiring.
  - *Status*: `[Out of scope for MVP]`

### Contradictions / Downgrades
* **Checkout Generation:**
  - *README Claim*: Mentions typical billing flows / webhook dependencies. 
  - *Code Truth*: `[PREVIOUS REPORT OVERCLAIMED]`. The actual checkout handler (`POST /api/v1/billing/checkout`) simply bypasses real interactions and returns a dev-string `cs_test_randomUUID()`. It does not initiate actual payment intent bridging via Stripe SDK. It is effectively a mocked placeholder endpoint enabling local flow traversal.
  - *Status*: `[Documented but not implemented / Mocked]`
