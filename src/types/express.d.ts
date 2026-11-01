declare global {
  namespace Express {
    interface Request {
      authorId?: string;
    }
  }
}

export {};