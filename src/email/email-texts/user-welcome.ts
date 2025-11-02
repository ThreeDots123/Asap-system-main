export default function userWelcomeMail(name: string) {
  return `<html>
  <head>
    <meta charset='utf-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1.0' />
    <title>Welcome to Lien & Doc!</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        text-align: center;
        padding: 20px 0;
        border-bottom: 2px solid #0056b3;
      }
      .logo {
        max-width: 180px;
        height: auto;
      }
      .container {
        padding: 20px 0;
      }
      h1 {
        color: #0056b3;
        margin-bottom: 20px;
      }
      .welcome-message {
        font-size: 16px;
        margin-bottom: 25px;
      }
      .cta-button {
        display: inline-block;
        background-color: #0056b3;
        color: white;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 4px;
        font-weight: bold;
        margin: 20px 0;
      }
      .features {
        margin: 30px 0;
        padding: 15px;
        background-color: #f9f9f9;
        border-radius: 5px;
      }
      .feature-item {
        margin-bottom: 10px;
      }
      .feature-icon {
        font-weight: bold;
        color: #0056b3;
      }
      .footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eee;
        font-size: 12px;
        color: #666;
        text-align: center;
      }
      .social-links {
        margin: 15px 0;
      }
      .social-link {
        margin: 0 10px;
        text-decoration: none;
        color: #0056b3;
      }
    </style>
  </head>
  <body>
    <div class='header'>
      <!-- Replace with your actual logo -->
      <img
          src="https://res.cloudinary.com/dqx2yewiq/image/upload/v1750355029/Doc%21/2_20250617_123539_0001_copy_t1grbs.png"
          alt="Company Logo"
          width="100"
          height="100"
          style="display: block; margin: 0 auto"
        />
    </div>

    <div class='container'>
      <p>Hi ${name},</p>

      <h1>Welcome to Doc! 🎉</h1>

      <div class='welcome-message'>
        <p>We're thrilled to have you on board!</p>
      </div>

      <div class='features'>
        <h3>At Doc!, we believe healthcare should be fast, smart, and always
          within reach. With our AI-powered platform, you can:</h3>

        <div class='feature-item'>
          <span class='feature-icon'>✓</span>
          Chat instantly with Dr. Pill, your AI medical assistant
        </div>
        <div class='feature-item'>
          <span class='feature-icon'>✓</span>
          Connect with licensed doctors
        </div>
        <div class='feature-item'>
          <span class='feature-icon'>✓</span>
          Receive reliable, convenient care—anytime, anywhere
        </div>
      </div>

      <p>Your journey to smarter healthcare starts now.</p>

      <p>👉 Log in to your account to explore all the features waiting for you.</p>

      <p>Need help getting started? Our support team is just a click away.</p>

      <p>Thanks for choosing Doc!</p>

      <p>We're here to help you feel better, faster.</p>

      <p>Warm regards,<br />
        The Doc! Team</p>
    </div>
  </body>
</html>`;
}
