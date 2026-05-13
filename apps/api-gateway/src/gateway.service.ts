import { Injectable, HttpException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
// form-data ships with axios as a direct dependency
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data');

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  private readonly services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    job: process.env.JOB_SERVICE_URL || 'http://localhost:3002',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3003',
  };

  constructor(private readonly httpService: HttpService) {}

  async proxyUpload(
    service: keyof typeof this.services,
    path: string,
    file: UploadedFile,
    body: any,
    headers?: Record<string, string>,
  ) {
    const url = `${this.services[service]}${path}`;
    this.logger.log(`Proxying POST (multipart) ${url}`);

    const form = new FormData();
    if (file) {
      form.append('resume', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.size,
      });
    }
    if (body?.coverLetter) {
      form.append('coverLetter', body.coverLetter);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, form, {
          headers: {
            ...form.getHeaders(),
            ...(headers?.authorization && { authorization: headers.authorization }),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }),
      );
      return response.data;
    } catch (err) {
      const status = err.response?.status || 500;
      const raw = err.response?.data?.message;
      const message = Array.isArray(raw)
        ? raw.join(', ')
        : (typeof raw === 'string' && raw) || 'Service error';
      throw new HttpException({ message, statusCode: status }, status);
    }
  }

  async proxy(
    service: keyof typeof this.services,
    path: string,
    method: string,
    data?: any,
    headers?: Record<string, string>,
  ) {
    const url = `${this.services[service]}${path}`;
    this.logger.log(`Proxying ${method} ${url}`);

    const config: AxiosRequestConfig = {
      method: method as any,
      url,
      ...(data != null && { data }),
      headers: {
        ...(data != null && { 'Content-Type': 'application/json' }),
        ...(headers?.authorization && { authorization: headers.authorization }),
      },
    };

    try {
      const response = await firstValueFrom(this.httpService.request(config));
      return response.data;
    } catch (err) {
      const status = err.response?.status || 500;
      const raw = err.response?.data?.message;
      const message = Array.isArray(raw)
        ? raw.join(', ')
        : (typeof raw === 'string' && raw) || 'Service error';
      throw new HttpException({ message, statusCode: status }, status);
    }
  }
}
