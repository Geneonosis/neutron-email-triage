# Jest testing rules

- Add or update Jest tests whenever a component contains functional business logic, or when changing context, hooks, state transitions, data transformations, or error handling.
- Test observable behavior and relevant success, failure, and edge cases. Avoid tests that only assert implementation details.
- Keep component tests in that component's `__tests__` folder, for example `renderer/components/component-name/__tests__/Component.test.tsx`.
- Keep application-context tests under `renderer/context/__tests__`.
- Use the repository's Jest configuration and Testing Library conventions; do not introduce another test framework for this work.
- Run the smallest relevant Jest test while iterating, then run the related suite before finishing.
