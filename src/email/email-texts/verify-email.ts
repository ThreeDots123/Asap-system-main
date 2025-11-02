export default function verifyEmail(otpCode: string, support_link: string) {
  return `    
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email — ASAP</title>
    <style>
      :root {
        --background: oklch(95% 0.01 320);
        --foreground: oklch(5% 0.02 290);
        --primary: oklch(82.5% 0.175 109);
        --primary-foreground: white;
        --card: white;
        --muted-foreground: oklch(40% 0.02 240);
        --radius: 12px;
        font-family: "Inter", system-ui, sans-serif;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --background: oklch(8% 0.02 290);
          --foreground: oklch(98% 0.02 290);
          --card: oklch(12% 0.02 290);
          --muted-foreground: oklch(70% 0.02 240);
        }
      }

      body {
        background: var(--background);
        color: var(--foreground);
        font-family: "Inter", system-ui, sans-serif;
        padding: 2rem;
      }

      .email-container {
        max-width: 640px;
        margin: 0 auto;
        background: var(--card);
        border-radius: var(--radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        padding: 2rem;
      }

      .header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .logo {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--primary);
        text-decoration: none;
      }

      h1 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }

      p {
        color: var(--muted-foreground);
        line-height: 1.6;
        font-size: 1rem;
      }

      .btn {
        display: inline-block;
        background: var(--primary);
        color: var(--primary-foreground);
        text-decoration: none;
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius);
        font-weight: 600;
        margin-top: 1.5rem;
      }

      .footer {
        margin-top: 2rem;
        text-align: center;
        font-size: 0.875rem;
        color: var(--muted-foreground);
      }

      .code-box {
        color: var(--primary);
        padding: 1rem;
        text-align: center;
        border-radius: var(--radius);
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: 2px;
        margin: 1.5rem 0;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <h1>Verify your email</h1>

      <p>
       Hello, welcome to <strong>ASAP</strong> — where crypto
        payments happen faster than ever ⚡
      </p>

      <p>
        Before we get you started, please confirm your email address so we can
        secure your account and unlock your merchant dashboard.
      </p>

      <!-- Option 2: Code (if you send a numeric token) -->
      <div class="code-box">${otpCode}</div>

      <p>
        This link will expire in 30 minutes. If you didn’t request this, you can
        safely ignore this email.
      </p>

      <div class="footer">
        <p>
          Need help? Just reply to this email or visit our
          <a href="${support_link}">Help Center</a>.
        </p>
        <p>
          🚀 The ASAP Team<br />
        </p>
      </div>
    </div>
  </body>
</html>
`;
}
