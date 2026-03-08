Write comprehensive tests for @ARGUMENTS

Testing conventions:

- Use Vitests with React Testing Library for React components
- Place tests in a `__tests__` directory adjacent to the code being tested
- Name test files with `.test.tsx` for React components and `.test.ts` for other code
- Use @/ prefix for imports

Coverage:

- Test happy paths
- Test edge cases
- Test error states
- Focus on testing behavior and public API, not implementation details
