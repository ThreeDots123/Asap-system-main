# 📌 Project To-Do List

## ⌚️ Scheduled Tasks

- [] Cron Jobs to remove expired initialMFA secrets, expired | revoked refresh tokens

## 👤 Users

- [x] Login user
- [x] user can receive access token from valid refresh token
- [x] Ensure OTP is deleted after use - decided to leave it, the implemented guard will not authorize a verified user.
- [x] user add transaction pin
- [x] user completes MFA - Works on google authenticator but not with authy
- [ ] Sign out user

## 📦 Extras

- [x] Add DTOs + validation with `class-validator`
- [ ] Setup Swagger/OpenAPI docs
- [ ] Add logging (winston / pino)
- [ ] Setup e2e tests
- [ ] Deploy project (Docker + cloud)
- [ ] Test that the soft delete works
- [ ] server does not start if requored envs are undefined

## Wallet Ochestration

- [x] Integrate Custody Provider SDK/HTTP client (for actual wallet creation, transactions, etc.) - [Blockradar]

- [x] On account creation, assign default **Base Wallet** (Both merchants and users)

- [x] Endpoint: `POST /wallet/add` → Add wallet for specific chain - [User]
- [ ] Endpoint: `POST /wallet/add` → Add wallet for specific chain - [Merchant]

- [x] Sync balances from custody provider (On asset retrieval)

- [ ] Sync balances from custody provider (On webhook event from transfer/withdrawal)
- [ ] Sync balances from custody provider (On webhook event from recieving coin (deposit))

- [ ] using webhook to complete the withdrawal transaction of a custodial provider (update ledger to posted if successful and manage failed events of webhook)

- [x] Setup Socket for realtime subscription
- [x] Store wallet addresses + metadata per chain

- [x] Endpoint: `GET /wallet/:userId` → List all wallets (& balances?)

- [x] Endpoint: `POST /wallet/chain/user/:chain/:asset/transfer/initiate` → Initiate wallet chain withdrawal
- [x] Endpoint: `POST /wallet/chain/user/:reference/transfer` → Send coins (with PIN/2FA validation) (Request withdrawal before performing withdrawal)

- [ ] Make some services/features require mfa validation before they work. (Add it for transactions when they are initiated.. also add MFA for transactions that are risky.)

- [ ] Endpoint: `GET /wallet/transactions` → Fetch transaction history
- [ ] Endpoint: `GET /wallet/receive/:walletId` → Retrieve deposit address / QR

- [ ] Endpoint: `POST /merchant/invoice` → Generate payment request (link/QR)
- [ ] Endpoint: `GET /merchant/payments/:merchantId` → List received payments

- [ ] Settlement flow:
  - [ ] `POST /merchant/settlement/request`
  - [ ] Process via custody provider (crypto/fiat payout)
  - [ ] Update merchant balance & settlement history
- [ ] Transaction validation (balance checks, PIN/2FA)
- [ ] Conversion utilities (fiat ↔ crypto equivalence)
- [ ] Webhook handlers for custody provider (deposit confirmations, transaction status updates)
- [ ] Notifications (transaction success/failure alerts)

## Payment Process

- [ ] Initiate payment (controller and service)

(Send some form of notifier to the admins when some errors occur e.g getting the current rate and not finding any because none exists)
The controllers for collecting currencies and assets for payment transactions should have the same validations as this will reduce discrepancy in the assets texts (e.g capital v small letters e.t.c)

Covert gas fee to the asset being withdrawn

Send Websocket event to notify user of successful coin debit?

Update address in payment service for the company wallets

Create admin guards (for rate)

<!-- Ledger Enteries Withfrawal has an entry for fee that was debited, we later transform the equivalent deducted from the user's asset back to the denominator that was debited from us and return it to the asset pool (document that too) -->

<!-- Loophole - Checking balance at every stage of transaction and Consistency - Since we can't make transactional queries. we. find another option (Esp for internal transactions)-->

<!-- 011 is statically used... remove before production -->

<!-- Used NG statically in external wallet monitoring -->

<!-- Increased the query pagination limit for transactions and Increased access token from 1h to 30d -->
<!-- Set merchant status default to verified on account creation -->
