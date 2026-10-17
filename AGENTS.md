# Agent instructions

## Required testing guidance

- Read `documentation/jest.md` when adding or changing functional logic or Jest tests.
- Read `documentation/storybook.md` when adding or changing UI components, stories, or Storybook interaction tests.
- Follow the more specific `AGENTS.md` files in the relevant directories; their instructions supplement this file.
- Run relevant Jest and Storybook tests after component changes.

## Project conventions

- This is a TypeScript, React, and Electron application. Edit source files, not generated output under `dist/` or `storybook-static/`.
- Preserve the existing module, formatting, and naming conventions. Keep types explicit and avoid weakening checks with `any` or broad casts.
- Avoid adding dependencies unless the task requires them; use the existing npm scripts and test tools.
- For CLI behavior, preserve the JSON response contract and send diagnostics to stderr. Surface failures explicitly rather than returning success-shaped defaults.

## Mail handling and safety

- Dry-run is the default. Never weaken the execute-mode trash threshold or its classification safeguards without an explicit user request.
- A per-message move to Trash or Archive must remain an explicit, individually confirmed user action.
- Tests must use the fake Bridge or mocked IPC/API boundaries. Never connect tests to a real mailbox or invoke the real classification service.
- Never expose credentials or secret values in logs, UI, test fixtures, or configuration output. Continue masking secrets in displayed configuration.
- Keep decision history local and do not transmit message data beyond the existing Jev classification flow. Do not add message-body transmission without explicit user approval.

## Electron boundaries

- Keep `contextIsolation` enabled and `nodeIntegration` disabled.
- Expose only narrow, typed operations through the preload bridge; validate IPC inputs before performing mailbox actions.
- Keep renderer code free of direct Node.js, filesystem, process, or credential access.
