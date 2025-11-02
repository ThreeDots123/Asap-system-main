export default function passwordReset(fullName: string, otpCode: string) {
  return `<html>
  <head>
    <style>
      .container {
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .otp-code {
        font-size: 24px;
        font-weight: bold;
        color: #2563eb;
        padding: 10px;
        background: #f3f4f6;
        border-radius: 4px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div class='container'>
      <h2>Password Reset Request</h2>
      <p>Hi ${fullName},</p>
      <p>We received a request to reset your password. Use this code to complete
        the reset:</p>
      <div class='otp-code'>${otpCode}</div>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't request this reset, please ignore this email or contact
        support.</p>
    </div>
  </body>
</html>`;
}
