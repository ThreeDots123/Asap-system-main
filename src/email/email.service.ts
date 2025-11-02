import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Mailjet from "node-mailjet";
import { MAILJET_API_KEY, MAILJET_SECRET_KEY } from "src/config/env/list";
import verifyEmail from "./email-texts/verify-email";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private mailjet: Mailjet;

  constructor(private configService: ConfigService) {
    const apiKey = configService.getOrThrow<string>(MAILJET_API_KEY);
    const apiSecret = configService.getOrThrow<string>(MAILJET_SECRET_KEY);

    this.mailjet = new Mailjet({
      apiKey,
      apiSecret,
    });
  }

  /**
   * Sends an email
   * @param to Recipient email
   * @param subject Email subject
   * @param text Plain text body
   * @param html HTML content (optional)
   */
  async sendMail(
    to: string | string[],
    subject: string,
    options?: {
      html?: string;
      from?: { email?: string; name?: string };
    },
  ) {
    try {
      const recipients = Array.isArray(to)
        ? to.map((email) => ({ Email: email }))
        : [{ Email: to }];

      const emailData: any = {
        Messages: [
          {
            From: {
              Email: options?.from?.email || "verify@asapcrypto.xyz",
              Name: options?.from?.name || "ASAP",
            },
            To: recipients,
            Subject: subject,
          },
        ],
      };

      if (options?.html) {
        emailData.Messages[0].HTMLPart = options.html;
      }

      await this.mailjet.post("send", { version: "v3.1" }).request(emailData);
      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error("Error sending email", error);
      throw error;
    }
  }

  async verificatonMail(
    email: string,
    subject: string,
    details: {
      otpCode: string;
      from?: { email?: string; name?: string };
    },
  ) {
    // const companyName = "ASAP";
    // const currentYear = new Date().getFullYear();
    const { from } = details;
    await this.sendMail(email, subject, {
      html: verifyEmail(details.otpCode, "https://support.asapcrypto.xyz"),
      from,
    });
  }
}
