import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';
import { ScreeningCompletedEvent } from './screening-completed.event';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  @OnEvent('screening.completed', { async: true })
  async handleScreeningCompleted(event: ScreeningCompletedEvent) {
    const { applicationId, matchScore, recommendation, recruiterEmail } = event;

    try {
      await this.transporter.sendMail({
        from: `"AI Screener" <${process.env.SMTP_USER}>`,
        to: recruiterEmail,
        subject: `AI Screening Complete — Score: ${matchScore}/100`,
        html: `
          <h2>Screening Result</h2>
          <p><strong>Application ID:</strong> ${applicationId}</p>
          <p><strong>Match Score:</strong> ${matchScore}/100</p>
          <p><strong>Recommendation:</strong> ${recommendation.replace('_', ' ').toUpperCase()}</p>
          <hr />
          <p style="color:#666;font-size:12px">This email was sent automatically by AI Resume Screener.</p>
        `,
      });

      this.logger.log(
        `Screening notification sent to ${recruiterEmail} for application ${applicationId}`,
      );
    } catch (err) {
      // Log and continue — email failure must never crash the screening service
      this.logger.error(
        `Failed to send screening notification to ${recruiterEmail}: ${err.message}`,
      );
    }
  }
}
