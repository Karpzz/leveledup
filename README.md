# LeveledUp Backend

This is the backend service for LeveledUp, a modern web application built with Node.js and Express.

🌐 Website: [https://leveledup.fun](https://leveledup.fun)

## Project Structure

```
src/
├── app.ts              # Main application setup and configuration
├── server.ts           # Server entry point
├── routes/            # API route handlers
├── services/          # Business logic and external service integrations
├── middleware/        # Express middleware functions
├── utils/            # Utility functions and helpers
├── types/            # TypeScript type definitions
├── cache/            # Caching layer implementations
└── uploads/          # File upload storage directory
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- TypeScript

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
PORT=3000
NODE_ENV=development
# Add other required environment variables
```

3. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication
- POST `/api/auth/login` - User login
- POST `/api/auth/register` - User registration
- POST `/api/auth/logout` - User logout

### User Management
- GET `/api/users/profile` - Get user profile
- PUT `/api/users/profile` - Update user profile
- GET `/api/users/settings` - Get user settings

### Security
- POST `/api/security/2fa/enable` - Enable 2FA
- POST `/api/security/2fa/disable` - Disable 2FA
- POST `/api/security/2fa/verify` - Verify 2FA code

## Development

### Code Style
- Follow TypeScript best practices
- Use ESLint for code linting
- Follow the existing project structure

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Building for Production
```bash
npm run build
```

## Deployment

The application can be deployed using:
- Docker
- Traditional Node.js hosting
- Serverless platforms

### Docker Deployment
```bash
# Build the Docker image
docker build -t leveledup-backend .

# Run the container
docker run -p 3000:3000 leveledup-backend
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 