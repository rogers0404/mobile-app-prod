## Token efficiency

- Search for the relevant code first. Read only the files and sections needed for the task.
- Keep tool output focused. Inspect relevant failures and diffs instead of dumping full logs or files.
- Reuse findings from earlier steps. Repeat checks only when something changed or the result was inconclusive.
- Keep updates brief. Report decisions, blockers, and verification results.

## Development

- Make the smallest change that fully solves the problem. Avoid unrelated refactors and formatting changes.
- Follow existing project conventions and reuse code where it fits. Add dependencies only when needed.
- Preserve public APIs and existing behavior unless the task calls for a change.
- Run the most relevant checks first. Broaden verification when shared logic or critical paths change.
- Never commit secrets or log credentials, tokens, or sensitive user data.
- Preserve existing work. Ask before destructive actions such as deleting data or force-pushing.