---
name: pr-ready
description: Verify branch is PR-ready
---

1. Run typecheck — fix ALL errors
2. Run lint — fix ALL errors
3. Run tests — fix any failures
4. Only after all pass, commit and push
5. Open PR with gh pr create
