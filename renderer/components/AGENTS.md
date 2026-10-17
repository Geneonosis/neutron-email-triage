# Component instructions

- Before creating or changing a component, read `documentation/storybook.md` and `documentation/jest.md`.
- Every component must have a colocated Storybook story with an interaction test covering meaningful user-facing behavior.
- Add or update Jest tests for functional business logic; keep presentation-only components free of business logic when practical.
- Put Jest tests under the component's `__tests__` directory.
- Follow existing accessibility, styling, TypeScript, and component-folder patterns.
