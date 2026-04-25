# Codex PR Workflow

This repository uses a simple handoff flow: Codex prepares the branch locally, GitHub Desktop is used to review, commit, push, and open the pull request.

## Branch Naming

Use a short branch name with the `codex/` prefix:

```text
codex/<topic>
```

Examples:

```text
codex/improve-elevenlabs-tts
codex/fix-session-sync
codex/admin-latency-dashboard
```

## What Codex Should Leave Ready

After each code change, Codex should provide:

- A concise summary of the user-facing or technical change.
- A list of important files changed.
- The validation commands that passed.
- Any validation commands that failed, with the reason.
- Known risks or follow-up work.
- A PR title and PR description that can be pasted into GitHub.

## Recommended PR Description

Use the repository pull request template and fill it like this:

```markdown
## Summary

- What changed in plain language.

## Why

- The user problem, product goal, bug, or technical reason.

## Changes

- Main implementation details.
- Important files or modules touched.

## Validation

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- Any manual test notes.

## Notes / Risks

- Known limitations.
- Areas reviewers should inspect carefully.

## Screenshots / Recordings

- Add screenshots or recordings for UI changes.
```

## GitHub Desktop Flow

1. Ask Codex to make the change and prepare a PR handoff.
2. Open the repository in GitHub Desktop.
3. Review the diff file by file.
4. Commit with a clear message.
5. Push the branch.
6. Click "Create Pull Request".
7. Paste the PR title and description prepared by Codex.

## Prompt To Reuse With Codex

```text
Prépare cette modification comme une PR GitHub Desktop:
- crée ou utilise une branche codex/<topic> si nécessaire;
- fais les changements;
- lance les validations pertinentes;
- donne-moi un titre de PR, une description structurée, les fichiers modifiés, les tests passés/échoués, et les risques;
- ne commit pas et ne push pas sauf si je le demande explicitement.
```

## Quality Bar

Before opening a PR, make sure one of these is true:

- Automated validation passed.
- Validation could not run for a clear environmental reason, and the reason is documented in the PR.
- The change is documentation-only and has been reviewed in the diff.
