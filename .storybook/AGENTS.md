# Storybook configuration instructions

- Read `documentation/storybook.md` before changing stories, Storybook setup, or interaction-test configuration.
- Keep Storybook local and deterministic; stories must not access the real mailbox, external APIs, or user credentials.
- Preserve the existing Vitest/Playwright interaction-test setup and verify changes with `npm run test:storybook`.
- Keep reusable component stories with their components under `renderer/components`.
