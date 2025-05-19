# Contributing to LeveledUp

Thanks for your interest in contributing to LeveledUp! This document provides guidelines and instructions for contributing.

## Development Workflow

### 1. Setup
- Fork the repository
- Clone your fork: `git clone https://github.com/YOUR_USERNAME/leveledup.git`
- Add upstream: `git remote add upstream https://github.com/ORIGINAL_OWNER/leveledup.git`
- Create a new branch: `git checkout -b feature/your-feature-name`

### 2. Development
- Write your code following our standards
- Write tests for new features
- Update documentation if needed
- Run tests: `npm test`
- Check linting: `npm run lint`

### 3. Before Submitting
- Rebase your branch with upstream: `git pull --rebase upstream main`
- Run all tests again
- Ensure your code is properly formatted
- Update your branch: `git push origin feature/your-feature-name`

### 4. Pull Request
- Create a PR from your fork to the main repository
- Fill out the PR template completely
- Link any related issues
- Request review from at least one maintainer

## Code Standards

### TypeScript
- Use strict type checking
- No `any` types unless absolutely necessary
- Document complex types with JSDoc comments

### Naming Conventions
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### Code Style
- Max line length: 100 characters
- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Use template literals for string interpolation

### Documentation
- Document all public APIs
- Include JSDoc comments for complex functions
- Keep README and API docs up to date

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or modifying tests
- `chore`: Changes to build process or auxiliary tools

### Example
```
feat(auth): add Google OAuth integration

- Add Google OAuth client configuration
- Implement OAuth callback handler
- Add user profile mapping

Closes #123
```

## Review Process

### 1. Code Review
- All PRs require at least one approval
- Address all review comments
- Keep PRs focused and small
- Respond to feedback within 48 hours

### 2. Merging
- PRs must pass all CI checks
- All tests must pass
- Documentation must be updated
- No merge conflicts

### 3. After Merging
- Delete your feature branch
- Update your fork
- Celebrate! 🎉

## Need Help?

- Visit our website: [https://leveledup.fun](https://leveledup.fun)
- Open an issue for bugs or feature requests
- Join our Telegram Community
- Check existing issues and PRs before creating new ones

## License

By contributing to LeveledUp, you agree that your contributions will be licensed under the project's MIT License.
