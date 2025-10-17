import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { EMAIL_HOST, EMAIL_PASS, EMAIL_USER } from "src/config/env/list";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // ✅ Create the transporter (use environment variables in production)
    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>(EMAIL_HOST),
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: configService.getOrThrow<string>(EMAIL_USER), // your email address
        pass: configService.getOrThrow<string>(EMAIL_PASS), // your email password or app password
      },
    });
  }

  /**
   * Sends an email
   * @param to Recipient email
   * @param subject Email subject
   * @param text Plain text body
   * @param html HTML content (optional)
   */
  async sendMail(to: string, subject: string, text: string, html?: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `charlieallen3077@gmail.com`,
        to,
        subject,
        text,
        html,
      });

      this.logger.log(`Email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error("Error sending email", error);
      throw error;
    }
  }
}
