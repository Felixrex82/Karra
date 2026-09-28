import { dispatchApiRequest } from '../server/apiDispatcher';

export default async function handler(req: any, res: any) {
  return dispatchApiRequest(req, res);
}



