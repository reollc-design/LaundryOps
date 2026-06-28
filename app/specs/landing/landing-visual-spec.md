# LaundryOps Landing Page Visual Spec

## Scope

This spec protects the signed-out LaundryOps mobile landing page from broad, accidental layout changes. It applies to the first screen a visitor sees before signing in or creating an account.

Do not use this spec to change authentication, Firebase setup, billing, dashboards, machine screens, maintenance records, reports, manuals, or logged-in app behavior.

## Target Viewports

- 390px wide mobile viewport
- 430px wide mobile viewport

These widths must be checked before and after each landing-page visual patch.

## Current Route And Structure

The signed-out landing page is currently the `welcome` screen inside `src/App.tsx`.

Current component flow:

- `App`
- `WelcomeScreen`
- `TrialFeatureIcon`
- `MachineIllustration`

Related signed-out access screens:

- `SignInScreen`
- `CreateAccountAccessScreen`
- `OwnerOnboardingScreen`

The Firebase status banner is rendered by `BackendSessionBanner`. It is useful for development diagnostics only and should not be customer-facing on the landing page or normal sign-in page.

## Protected Areas

Do not affect these areas while working on landing-page visuals:

- Authentication logic
- Firebase configuration
- Stripe or billing flow
- Dashboard pages
- Machine list, machine detail, maintenance records, manuals, reports, and AI repair screens
- Firestore, Storage, Functions, or rules behavior
- Existing business copy unless Robert explicitly asks to change it
- Sign-in button behavior
- Create-account flow
- Start-trial CTA behavior

## Allowed Files To Edit

Preferred landing-only files after isolation:

- `src/App.tsx`
- `src/styles.css`
- Future landing components under `src/landing/` or `src/components/landing/`
- Future landing CSS under `src/landing.css` or landing-only sections of `src/styles.css`
- Visual test files under `tests/landing/` or `tools/visual/`
- Screenshot output under `test-results/landing/`

Avoid app-wide CSS changes unless no landing-only option exists.

## Naming Rules

Future landing-specific class names should use the `lo-` prefix.

Examples:

- `lo-page`
- `lo-header`
- `lo-logo`
- `lo-signin-button`
- `lo-hero`
- `lo-hero-content`
- `lo-trial-badge`
- `lo-hero-title`
- `lo-hero-copy`
- `lo-hero-machine`
- `lo-primary-cta`
- `lo-secondary-cta`
- `lo-feature-card`

Do not add broad landing selectors such as:

- `button`
- `img`
- `h1`
- `.card`
- `.container`
- `.hero`

## Header Rules

The mobile header should match the reference layout:

- Hamburger icon on the left.
- LaundryOps logo and wordmark beside it.
- `Maintenance command center` subtitle under the wordmark.
- Sign-in button on the right.
- `LaundryOps` must stay on one line.
- The sign-in button must not wrap, clip, or overlap the logo.
- The header should not show fake phone chrome, fake time, fake notch, or fake browser address UI.

## Hero Rules

The hero card should match the reference layout:

- Dark blue/green gradient background.
- Rounded corners.
- Yellow `14-Day Free Trial` badge near the top left.
- Headline text:
  - `More uptime.`
  - `More revenue.`
- `uptime` should be green.
- `revenue` should be yellow.
- Supporting copy should sit below the headline.
- Washer image must stay inside the hero card.
- Washer image must not push the layout around.
- Washer image must not cover the headline.
- Washer image should be positioned independently from text, preferably absolute-positioned and anchored to the right and/or bottom.
- Hero card must use `position: relative` and `overflow: hidden`.
- Hero text should have a higher stacking order than background decorations.
- The washer may be partially cropped by the hero edge if needed.
- The washer should not force the hero card taller unless that is intentional.

## CTA Rules

- Green `Start 14-Day Free Trial` button below the hero card.
- White outlined `Create Account` button below the trial button.
- Both buttons should be full-width within the landing content column.
- Buttons should align with the hero card and feature cards.
- Buttons must not overlap the hero.
- Buttons must continue to trigger the existing create-account/trial flow.

## Feature Card Rules

- White rounded cards.
- Icon on the left.
- Text on the right.
- Consistent spacing, shadow, and alignment.
- Feature cards should remain stable after header or hero fixes.

## Patch Rules

Each future patch should fix one visual area only.

Patch order:

1. Header spacing and logo/sign-in alignment.
2. Hero card sizing.
3. Washer image placement.
4. Headline and body text spacing.
5. CTA button spacing and sizing.
6. Feature card alignment and spacing.

After each patch:

1. Run `npm run build`.
2. Run `npm run visual:landing`.
3. Compare the new screenshots to the previous screenshots and the attached visual target.
4. Report exactly what changed.
5. Do not proceed to the next area until the current area is stable.

## Visual Verification

Required screenshot outputs:

- `test-results/landing/landing-390.png`
- `test-results/landing/landing-430.png`

The first goal is reliable screenshots, not pixel-perfect comparison. Pixel comparison can be added later after the layout is stable.

## Developer-Only Diagnostics

The Firebase connection banner is a diagnostic aid, not a customer-facing element.

It should not appear on:

- Public landing page
- Normal sign-in page
- Normal create-account page

If retained, it should be limited to local development, admin diagnostics, or an explicit debug mode.
