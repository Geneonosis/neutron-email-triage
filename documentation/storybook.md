# Storybook testing rules

- Every React UI component must have a colocated `.stories.tsx` file that demonstrates its meaningful states and intended use.
- Add a Storybook interaction test for user-facing behavior, such as activating controls, switching views, changing state, or showing disabled/error states.
- Use the existing Storybook `play` function and `storybook/test` utilities (`within`, `userEvent`, and `expect`) for interaction coverage.
- Keep stories representative and deterministic; use mocked callbacks and fixed sample data rather than external services or real user data.
- Run the relevant Storybook test project after updating stories or component behavior.
