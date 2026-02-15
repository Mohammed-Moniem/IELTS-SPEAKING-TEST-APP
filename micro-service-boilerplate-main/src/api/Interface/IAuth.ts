export interface ICurrentUser {
  id: string;
  email: string;
  plan?: string;
  scope?: string[];
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: ICurrentUser;
    }
  }
}
