export interface ICurrentUser {
  id: string;
  email: string;
  plan?: string;
  roles?: string[];
  subscriptionPlan?: string;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: ICurrentUser;
    }
  }
}
