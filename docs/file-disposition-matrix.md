# File Disposition Matrix

| File path | Purpose | Status | Why | Replacement source-of-truth | Risk if kept |
|---|---|---|---|---|---|
| `/docs/00-master-source-of-truth.md` | Core spec blueprint | **Keep** | Architectural master. | N/A | None |
| `/README.md` | Dev ingress portal | **Keep** | Updated organically. | N/A | None |
| `/Viprosell_Spec_CHOT_v1.2.md` | Obsolete draft | **Deleted**| Redundant legacy scope. | `00-master-source-of-truth.md` | Operator hallucination |
| `/mo_ta.md` | Initial sketch doc | **Deleted**| Extreme scope creep. | `01-scope-lock-final.md` | Scope expansion risk |
| `/QA_MATRIX.md` | Legacy checklist | **Deleted**| Outdated QA metrics. | `docs/launch-pack-final-checklist.md` | Wastes QA time |
| `/LOCAL_SETUP.md` | Old dev hints | **Deleted**| Conflicted drastically. | `docs/local-runtime-pack.md` | Misconfigures envs |
| `/docs/15-architecture-addendum.md`| Old massive prompts | **Deleted**| Legacy Lovable/VibeMotion scopes explicitly blocked. | Prompts embedded natively in code. | Architect override |
| `docs/go-live-decision.md` | QA Gate decision | **Keep** | Formal signoff log. | N/A | None |
| `docs/14-internal-audit-phase11.md` | Audit Log | **Archive**| Có giá trị theo dõi Phase Gate. | N/A | None |
| `docs/12-qa-test-matrix.md` | Audit Log | **Archive**| Có giá trị đối chiếu QA Audit. | N/A | None |
