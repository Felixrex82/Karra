import app from '../server';

export default function handler(req: any, res: any) {
  if (req && req.body !== undefined && req.body !== null) {
    req._body = true;
  }
  return app(req, res);
}


