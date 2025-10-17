const events = {
  awaitableEvent: {
    response: "awaitable.response",
    error: "awaitable.error",
  },
  account: {
    created: {
      user: "account.user.created",
      merchant: "account.merchant.created",
    },
  },
  "asset-balance": {
    change: "balance.change",
  },
  offramp: {
    transaction: {
      funded: "offramp.transaction.funded",
    },
  },
};

export default events;
