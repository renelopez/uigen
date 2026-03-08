---
name: audit
description: Audit the codebase for security issues, code quality problems, and missing test coverage
---

Perform a thorough audit of the codebase (or $ARGUMENTS if a specific file or directory is provided). Cover:

1. **Security**: Look for vulnerabilities (XSS, SQL injection, exposed secrets, improper auth checks, unsafe use of dangerouslySetInnerHTML, etc.)
2. **Code quality**: Identify dead code, duplicated logic, overly complex functions, and missing error handling at system boundaries
3. **Test coverage**: Flag files or functions that lack tests, especially critical paths like auth, API routes, and data transforms
4. **Dependencies**: Note any outdated or suspicious packages

For each issue found, include:
- File path and line number
- Severity: `high`, `medium`, or `low`
- A brief explanation and recommended fix

Summarize findings at the end with a count per severity level.
