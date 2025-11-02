export default function sendPasswordlessEmailToken(
  logoUrl: string,
  otpCode: string,
  currentYear: number,
  companyName: string,
) {
  return `<html>
  <head>
    <meta charset='UTF-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1.0' />
    <title>Email Verification</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 30px;
        text-align: center;
      }
      .logo {
        margin-bottom: 20px;
      }
      .otp-code {
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 4px;
        color: #2563eb;
        margin: 20px 0;
        padding: 10px;
        background-color: #fff;
        border-radius: 4px;
        display: inline-block;
      }
      .expiry {
        color: #dc2626;
        font-weight: bold;
        margin: 15px 0;
      }
      .footer {
        margin-top: 30px;
        font-size: 12px;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class='container'>
      <div class='logo'>
        <img
          src="https://res.cloudinary.com/dqx2yewiq/image/upload/v1750355029/Doc%21/2_20250617_123539_0001_copy_t1grbs.png"
          alt="Company Logo"
          width="100"
          height="100"
          style="display: block; margin: 0 auto"
        />
      </div>

      <h2>Here is your login token</h2>

      <p>Please use the following token to complete your login process:</p>

      <div class='otp-code'>${otpCode}</div>

      <p class='expiry'>This code will expire in 2 minute</p>

      <p>If you didn't request this verification, please ignore this email or
        contact support if you have concerns.</p>

      <div class='footer'>
        <p>This is an automated message, please do not reply to this email.</p>
        <p>&copy; ${currentYear} ${companyName}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`;
}
