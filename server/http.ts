import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function asyncRoute(handler: AsyncRoute): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function parseId(value: string | string[]) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw Object.assign(new Error('The requested record was not found.'), { status: 404 });
  }
  return value;
}

export function requireManagerId(request: Request) {
  if (!request.managementUser) throw Object.assign(new Error('Management sign-in is required.'), { status: 401 });
  return request.managementUser.id;
}
