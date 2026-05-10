import { Injectable, HttpException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  private readonly services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    job: process.env.JOB_SERVICE_URL || 'http://localhost:3002',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3003',
  };

  constructor(private readonly httpService: HttpService) {}

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
      data,
      headers: {
        'Content-Type': 'application/json',
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
