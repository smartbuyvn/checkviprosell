# Repo Cleanup Plan

## Trạng Thái (Finalized & Executed)

Toàn bộ quá trình quét rác (File Redundancy / Legacy Contamination) đã bước qua giai đoạn Physical Delete:

### Deleted Forever (Irreversible):
- `Viprosell_Spec_CHOT_v1.2.md` -> Xóa sổ (Không rollback value, không references).
- `mo_ta.md` -> Xóa sổ (Scope rác về Face Swap/Wordpress).
- `DEPLOY_ENV_MATRIX.md`, `STAGING_DEPLOY.md` -> Xóa sổ (Vercel/Cloud configs giả mạo).
- `QA_MATRIX.md`, `SMOKE_TEST_CHECKLIST.md` -> Xóa sổ.
- `LOCAL_SETUP.md`, `OPERATIONS.md`, `RUNBOOK.md` -> Xóa sổ.
- `15-architecture-templates-prompts-addendum.md` -> Xóa sổ (File khổng lồ 45KB chứa Prompt nhảm về VibeMotion / Batch AI Video / Sub-agents). 

### Retained in Archive (Read-Only):
- `14-internal-audit-phase11.md` -> Giữ lại làm bằng chứng Audit Rollback.
- `12-qa-test-matrix.md` -> Giữ lại nguyên mẫu QA.

**Kết luận**: Không còn tàn dư VibeMotion, Face Swap, WordPress Batch hay các Mock Endpoint ảo trong repo `vi-pro-sell`. Lịch sử dọn dẹp kết thúc an toàn.
