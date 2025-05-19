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
# Database Configuration
MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name

# Authentication
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# API Keys
RAPID_API_KEY=your_rapid_api_key
COINGECKO_API_KEY=your_coingecko_api_key
SOLANA_TRACKER_API_KEY=your_solana_tracker_api_key

# Blockchain
RPC_URL=your_rpc_url

```

3. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication Routes (`/auth`)
- `POST /auth/register` - Register a new user
  ```typescript
  // Response
  {
    token: string;
    user: {
      _id: string;
      username: string;
      bio: string;
      name: string;
      profile_image_url: string;
      wallet_address: string | null;
      notifications: {
        price_alerts: boolean;
        transaction_updates: boolean;
        security_alerts: boolean;
      };
      type: string;
      twoFactor: boolean;
    }
  }
  ```

- `POST /auth/login` - User login
  ```typescript
  // Response
  {
    token: string;
    user: {
      _id: string;
      username: string;
      bio: string;
      name: string;
      profile_image_url: string;
      wallet_address: string | null;
      notifications: {
        price_alerts: boolean;
        transaction_updates: boolean;
        security_alerts: boolean;
      };
      type: string;
      twoFactor: boolean;
    }
  }
  ```

- `POST /auth/wallet/connect` - Connect wallet to user account
  ```typescript
  // Response
  {
    token: string;
    user: {
      _id: string;
      username: string;
      name: string;
      profile_image_url: string;
      wallet_address: string;
      twitter_id: string;
      type: string;
      twoFactor: boolean;
      notifications: {
        price_alerts: boolean;
        transaction_updates: boolean;
        security_alerts: boolean;
      };
    }
  }
  ```

### Two-Factor Authentication (`/2fa`)
- `POST /2fa/setup` - Generate 2FA secret and QR code
  ```typescript
  // Response
  {
    success: boolean;
    qrCode: string;
    secret: string; // Backup key for manual entry
  }
  ```

- `POST /2fa/verify` - Verify and enable 2FA
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```

- `POST /2fa/validate` - Validate 2FA token for login
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```

- `POST /2fa/disable` - Disable 2FA
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```

- `GET /2fa/status` - Get 2FA status
  ```typescript
  // Response
  {
    success: boolean;
    enabled: boolean;
    setupInProgress: boolean;
  }
  ```

### User Management (`/api/user`)
- `POST /api/user/profile` - Update user profile
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```

- `POST /api/user/avatar` - Update user avatar
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
    profile_image_url: string;
  }
  ```

### Portfolio & Prices (`/api/portfolio`, `/api/prices`)
- `GET /api/portfolio` - Get user's token portfolio
  ```typescript
  // Response
  {
    // Portfolio data structure
  }
  ```

- `GET /api/prices` - Get all token prices
  ```typescript
  // Response
  {
    prices: Record<string, number>;
  }
  ```

- `GET /api/prices/:token` - Get specific token price
  ```typescript
  // Response
  {
    token: string;
    price: number;
  }
  ```

### OTC Trading (`/api/otc`)
- `POST /api/otc/create` - Create new OTC trade
  ```typescript
  // Request Body
  {
    creator: {
      userId: string;
      walletAddress: string;
    };
    token: {
      address: string;
      amount: string;
      recipient: string;
      metadata: any;
    };
    solana: {
      amount: string;
      recipient: string;
    };
    escrowWallet: string;
  }
  // Response
  {
    success: boolean;
    tradeId: string;
    escrowWallet: string;
    trade: OTCData;
  }
  ```
- `GET /api/otc` - Get user's OTC trades
  ```typescript
  // Response
  {
    success: boolean;
    trades: OTCData[];
  }
  ```
- `GET /api/otc/trades/:tradeId` - Get specific OTC trade
  ```typescript
  // Response
  {
    success: boolean;
    trade: OTCData;
  }
  ```
- `GET /api/otc/validate/:walletAddress` - Validate wallet address
  ```typescript
  // Response
  {
    success: boolean;
    balance: number;
  }
  ```

### Support System (`/api/support`)
- `POST /api/support` - Create support ticket
  ```typescript
  // Request Body
  {
    email: string;
    subject: string;
    message: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
  }
  // Response
  {
    success: boolean;
    message: string;
    ticketId: string;
  }
  ```
- `GET /api/support` - Get user's support tickets
  ```typescript
  // Response
  {
    success: boolean;
    tickets: SupportTicket[];
  }
  ```
- `POST /api/support/:support_ticket_id/reply` - Reply to support ticket
  ```typescript
  // Request Body
  {
    message: string;
  }
  // Response
  {
    success: boolean;
    message: string;
  }
  ```
- `GET /api/support/:support_ticket_id` - Get specific support ticket
  ```typescript
  // Response
  {
    success: boolean;
    ticket: SupportTicket;
  }
  ```

### Features & Feedback (`/api/features`)
- `POST /api/features` - Submit feature request
  ```typescript
  // Request Body
  {
    email: string;
    subject: string;
    message: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
  }
  // Response
  {
    success: boolean;
    message: string;
    featureId: string;
  }
  ```
- `GET /api/features` - Get user's feature requests
  ```typescript
  // Response
  {
    success: boolean;
    features: Feature[];
  }
  ```

### Trade Journal (`/api/journal`)
- `POST /api/journal` - Create trade journal entry
  ```typescript
  // Request Body
  {
    pair: string;
    type: string;
    entry: number;
    exit: number;
    amount: number;
    notes: string;
    status: string;
  }
  // Response
  {
    success: boolean;
    message: string;
    trade: TradeData;
  }
  ```
- `GET /api/journal` - Get user's trade journal entries
  ```typescript
  // Response
  {
    success: boolean;
    trades: TradeData[];
  }
  ```

### Calculators (`/api/calculators`)
- `POST /api/calculators` - Save calculation
  ```typescript
  // Request Body
  {
    name: string;
    type: string;
    data: {
      entryPrice: string;
      stopLoss: string;
      takeProfit: string;
      positionSize: string;
      result: {
        riskPercent: number;
        riskAmount: number;
        gainAmount: number;
        ratio: number;
        breakeven: number;
      };
    };
  }
  // Response
  {
    success: boolean;
    message: string;
    calculation: CalculationData;
  }
  ```
- `GET /api/calculators` - Get user's calculations
  ```typescript
  // Response
  {
    success: boolean;
    calculations: CalculationData[];
  }
  ```
- `PUT /api/calculators/:id` - Update calculation
  ```typescript
  // Request Body
  {
    name: string;
    type: string;
    data: CalculationData['data'];
  }
  // Response
  {
    success: boolean;
    message: string;
    calculation: CalculationData;
  }
  ```
- `DELETE /api/calculators/:id` - Delete calculation
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
    calculation: any;
  }
  ```

### Notifications (`/api/notifications`)
- `GET /api/notifications` - Get user's notifications
  ```typescript
  // Response
  {
    success: boolean;
    notifications: Notification[];
    settings: {
      price_alerts: boolean;
      transaction_updates: boolean;
      security_alerts: boolean;
    };
  }
  ```
- `POST /api/notifications/mark-all-read` - Mark all notifications as read
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```
- `POST /api/notifications/clear-all` - Clear all notifications
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```
- `POST /api/notifications/:id/read` - Mark notification as read
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```
- `DELETE /api/notifications/:id` - Delete notification
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
  }
  ```
- `POST /api/notifications/:type/toggle` - Toggle notification type
  ```typescript
  // Response
  {
    success: boolean;
    message: string;
    notifications: {
      price_alerts: boolean;
      transaction_updates: boolean;
      security_alerts: boolean;
    };
  }
  ```

### News (`/api/news`)
- `GET /api/news` - Get latest news
  ```typescript
  // Response
  {
    // News data structure
  }
  ```

### Swap Operations (`/swap`)
- `POST /swap/execute` - Execute token swap
  ```typescript
  // Request Body
  {
    signedTransaction: string;
    fromToken: string;
    toToken: string;
    amount: string;
  }
  // Response
  {
    success: boolean;
    signature: string;
    fromToken: string;
    toToken: string;
    amount: string;
  }
  ```

### File Management (`/files`)
- `GET /files/:file_id` - Serve file

### Environment Variables
```env
# Database Configuration
MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name

# Authentication
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# API Keys
RAPID_API_KEY=your_rapid_api_key
COINGECKO_API_KEY=your_coingecko_api_key
SOLANA_TRACKER_API_KEY=your_solana_tracker_api_key

# Blockchain
RPC_URL=your_rpc_url
```

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