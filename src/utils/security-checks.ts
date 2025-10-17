export default function securityChecks(mfa?: boolean) {
  return {
    securityChecks: {
      pin: true,
      ...(mfa && { mfa }),
    },
  };
}
