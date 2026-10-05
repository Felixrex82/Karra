import app from '../server';
import { dispatchApiRequest } from '../server/apiDispatcher';

export { createAdminSession, isValidAdminSession } from '../server';

/**
 * Universal Single Serverless Function Entry Point for Vercel
 * Delegates to the central Express server.ts application and universal apiDispatcher.
 */
export default async function handler(req: any, res: any) {
  if (typeof (app as any)?.handle === 'function' && typeof req?.on === 'function') {
    return (app as any)(req, res);
  }
  return dispatchApiRequest(req, res);
}
