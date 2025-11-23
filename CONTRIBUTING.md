# Contributing to Quest Navigation Browser Configuration Tool

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature or bugfix
4. Make your changes
5. Test your changes thoroughly
6. Submit a pull request

## Development Setup

### Prerequisites
- Node.js 20+
- npm or yarn
- Git

### Local Development
```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start development servers
cd backend && npm run dev  # Terminal 1
cd frontend && npm run dev # Terminal 2
```

## Code Style

### TypeScript
- Use TypeScript for all new code
- Avoid `any` types when possible
- Define proper interfaces and types
- Use meaningful variable and function names

### React Components
- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use proper TypeScript types for props

### Backend Code
- Use async/await over callbacks
- Implement proper error handling
- Validate all user inputs
- Use prepared statements for database queries

## Testing

Before submitting a pull request:
1. Test the application in development mode
2. Run type checking: `npm run typecheck`
3. Test with a real Quest device if possible
4. Test in different browsers (Chrome, Edge, Brave)

## Pull Request Process

1. Update README.md if adding features
2. Add comments to complex code sections
3. Ensure all TypeScript checks pass
4. Describe your changes in the PR description
5. Link any related issues

## Reporting Issues

When reporting issues, include:
- Browser name and version
- Quest model and firmware version
- Steps to reproduce
- Error messages or logs
- Expected vs actual behavior

## Feature Requests

Feature requests are welcome! Please:
- Check if the feature already exists
- Describe the use case clearly
- Explain why it would be valuable
- Consider implementation complexity

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

Thank you for contributing!

