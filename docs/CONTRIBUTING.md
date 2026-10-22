# Contributing to HandyNaija

Thank you for your interest in contributing! This document outlines the process for contributing to the HandyNaija project.

## Getting Started

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up the development environment:
   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials
   npm run migrate
   npm run dev
   ```

## Code Style

### Frontend (React)
- Use functional components with hooks
- Follow the naming conventions:
  - Components: PascalCase (e.g., Header.jsx)
  - Utilities: camelCase
- Use Tailwind CSS for styling
- Keep components small and focused

### Backend (Node.js/Express)
- Follow the layered architecture pattern
- Use async/await with try-catch or asyncHandler wrapper
- Validate all user input with express-validator
- Use consistent API response format
- Follow the naming conventions:
  - Files: kebab-case (e.g., auth.routes.js)
  - Classes: PascalCase
  - Variables: camelCase

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Guidelines
- Write tests for all new features
- Maintain 80%+ code coverage
- Test both success and error cases
- Use descriptive test names

## Pull Request Process

1. Ensure all tests pass
2. Run linting:
   ```bash
   npm run lint
   ```
3. Update documentation if needed
4. Create a pull request with:
   - Clear title: `[Component] Description`
   - Description of changes
   - Screenshots or videos (for UI changes)
   - Related issue numbers

## Code Review

All pull requests must be reviewed by at least one maintainer. The reviewer will check:
- Code quality and style
- Test coverage
- Performance impact
- Security considerations
- Documentation updates

## Issue Reporting

When reporting issues, please include:
- Description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, browser, Node version)
- Screenshots or error logs

## Branch Naming
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

## Commit Messages
Use the following format:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Questions?

Feel free to open an issue or reach out to the maintainers.
