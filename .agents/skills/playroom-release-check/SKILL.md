---
name: playroom-release-check
description: Review PLAYROOM readiness before merging or deploying. Use when checking a release, Vercel preview, Supabase migration, or production handoff.
---

# Check a PLAYROOM release

1. Inspect the Git diff and confirm the change is inside the requested scope.
2. Check that secrets remain in environment variables and that `.env.example` is safe.
3. Check migrations, room protocol changes, and game adapter changes for compatibility.
4. Run the narrowest relevant tests and build checks available in the repository.
5. Return blockers, warnings, and a short go/no-go summary with file references.

Completion means every blocker is either resolved or explicitly handed back to the owner.

