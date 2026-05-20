# LaundryOps Decision Queue

These are important product decisions, but they do not need to interrupt the current UI build.

## Machine Numbering

- Question: How should LaundryOps handle machines that start with a letter, a number, or a mixed format?
- Current working direction: Treat machine numbers as text IDs, not pure numbers. That supports W12, D07, 101, A-14, and store-specific naming without breaking search or sorting.
- Decide when: Before the real machine database/import flow is built.

## Multi-Location Subscription Model

- Question: Should laundromat companies with multiple locations need separate subscriptions, one subscription with locations included, or an add-on fee per extra location?
- Current working direction: Use one company account with one subscription, one included location, a 14-day free trial, and an add-on fee per additional location. That keeps billing simple while letting operators manage all locations from one login.
- Decide when: Before Stripe/subscription setup and account permissions are implemented.
