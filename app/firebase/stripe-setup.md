# Stripe Billing Setup (LaundryOps)

This is the minimum setup for the new billing foundation:

- Stripe Checkout Session endpoint
- Stripe Billing Portal endpoint
- Stripe webhook endpoint with signature verification

## 1) Create Stripe product + recurring price

In Stripe Dashboard:

1. Go to `Product catalog`.
2. Create product `LaundryOps Pro`.
3. Add a recurring monthly price and annual price.
4. Copy each price ID (looks like `price_...`).

## 2) Set Firebase Functions secrets

From the app root (`C:\Users\reoll\CODEX\projects\LaundryOps\app`), set secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Use Firebase secret manager for these. Do not put them in frontend `.env` files.

## 3) Configure Functions runtime env (non-secret)

Set these for Functions:

- `STRIPE_MONTHLY_PRICE_ID=price_...`
- `STRIPE_ANNUAL_PRICE_ID=price_...`
- `STRIPE_TRIAL_DAYS=14`
- `STRIPE_SUCCESS_URL=https://YOUR_APP_DOMAIN/account?billing=success`
- `STRIPE_CANCEL_URL=https://YOUR_APP_DOMAIN/account?billing=cancel`
- `STRIPE_BILLING_RETURN_URL=https://YOUR_APP_DOMAIN/account`

The deployed LaundryOps functions include safe defaults for the current plans:

- Monthly price: `price_1TaMpBJkHhybNz7F4VtKJ5Na`
- Annual price: `price_1TaMprJkHhybNz7FHvsmgQdh`
- App URL: `https://laundryops-maintenance-app.web.app`

Only set the runtime env values above when overriding those defaults.

## 4) Deploy functions

Deploy at least:

- `createStripeCheckoutSession`
- `createStripeBillingPortalSession`
- `stripeWebhook`

## 5) Wire frontend to backend base URL

In app `.env` (or environment config), set:

- `VITE_BILLING_API_BASE_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net`

Frontend endpoints are:

- `POST {VITE_BILLING_API_BASE_URL}/createStripeCheckoutSession`
- `POST {VITE_BILLING_API_BASE_URL}/createStripeBillingPortalSession`

Both require Firebase Auth Bearer token.

## 6) Add Stripe webhook

In Stripe Dashboard:

1. Go to `Developers` -> `Webhooks`.
2. Add endpoint:
   `https://us-central1-YOUR_PROJECT.cloudfunctions.net/stripeWebhook`
3. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret and store as `STRIPE_WEBHOOK_SECRET`.

## 7) Verify end-to-end

1. Sign in as owner/admin in LaundryOps.
2. Open Account screen.
3. Select Annual or Monthly.
4. Tap `Start Annual Plan` or `Start Monthly Plan` and confirm Stripe Checkout opens with the selected price.
5. Complete checkout in Stripe test mode.
6. Verify webhook updates organization billing fields in Firestore.
7. Tap `Manage Billing` and confirm portal opens.
