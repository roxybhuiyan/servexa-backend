import type { Response } from 'express';

type SendResponseOptions<T> = {
  statusCode: number;
  message: string;
  data: T;
};




const sendResponse = <T>(res: Response, options: SendResponseOptions<T>): void => {
  res.status(options.statusCode).json({
    success: true,
    message: options.message,
    data: options.data,
  });
};

export default sendResponse;
