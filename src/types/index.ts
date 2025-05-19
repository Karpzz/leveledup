export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  created_at: Date;
  accessToken: string;
  refreshToken: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface User extends TwitterUser {}
  }
} 

export interface Notification {
  id: string;
  user_id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

export interface CalculationData {
  user_id: any;
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
  date: string;
}

export interface AttachmentData {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface Feature {
  user_id: any;
  email: string;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  attachments?: AttachmentData[];
  createdAt: Date;
  status: 'open' | 'in-progress' | 'closed';
  response?: string | null;
  votes: {
    up: number;
    down: number;
  };
}

export interface TradeData {
  user_id: any;
  pair: string;
  type: string;
  entry: number;
  exit: number;
  amount: number;
  notes: string;
  status: string;
  date: string;
}


export interface OTCData {
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

export interface SupportMessage {
  from: string;
  message: string;
  time: Date;
  read: boolean;
  attachments?: string[];
}

export interface SupportTicket {
  user_id: any;
  email: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  status: 'open' | 'in-progress' | 'closed';
  messages: SupportMessage[];
}
