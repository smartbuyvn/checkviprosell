# Viprosell v1.2 Release Smoke Test

Run this checklist strictly prior to any `staging -> main` branch merge. Total execution time should strictly be under 30 minutes.

### Preparation
- [ ] Connect to Staging Environment URL (Not localhost / Not production).
- [ ] Log in with a standard Beta-User account possessing minimum 10 credits.

### 1. The Lightning Ad (3 Minutes)
- [ ] Start a `QUICK ADS` project.
- [ ] Add 3 images from a test fixture + a valid Shopee Link.
- [ ] Select Aspect: `9:16`.
- [ ] Select Mode: `simple_crop`.
- [ ] Target Validation: Does the AI output the script in <10 seconds? Does the video fully compile in <20 seconds? Does it download successfully?

### 2. The Premium KOC Test (10 Minutes)
- [ ] Start a `REVIEW VIDEO` project.
- [ ] Upload 5 images + 1 sample video element.
- [ ] Toggle FaceFusion Premium ON.
- [ ] Select Aspect: `16:9`.
- [ ] Select Mode: `smart_pan`.
- [ ] Target Validation: Does the face properly swap in the resulting video? Does the aspect ratio cleanly frame the focal points?

### 3. The Auto-Layout Conversion Test (5 Minutes)
- [ ] Start a `CONVERSION VIDEO` project.
- [ ] Upload 8 images.
- [ ] Select Aspect: `1:1`.
- [ ] Select Mode: `relayout`.
- [ ] Target Validation: Does the generated video contain the AIDA framework script? Does the scene composition cleanly divide screen real estate for assets vs text?

### 4. Financial Integrity Trap (10 Minutes)
- [ ] Disconnect internet / Drop VPN manually simulating a user dropping connection mid-poll.
- [ ] Resume connection, ensure the UI regains polling control without locking.
- [ ] Submit a dummy project, forcefully stop the render worker Node container mid-encode.
- [ ] Target Validation: Verify the `renders` database marks `failed`. Verify the `profiles` credit count did NOT drop from previous state. Verify `idempotency_key` blocks any double charge.

### GO / NO-GO 
If any box fails, immediately abort deploy and revert Staging.
