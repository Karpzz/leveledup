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