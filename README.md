# Bella Vista Oasis Spa — school demonstration

The public site is static HTML/CSS/JavaScript in `dist/`. Netlify Functions provide the trusted server layer; Supabase provides PostgreSQL, staff authentication, and a private receipt bucket. Resend is optional. The existing generated imagery is conceptual, not photography of the spa. Replace media paths in `dist/assets-config.js` when approved images and video are available.

**Use fictional data only. Do not collect real customer health information until the project's privacy, security, retention, consent, and operational arrangements have been reviewed.** This project has not been independently security audited. Receipt uploads are a demonstration; no payment processor is integrated and receipt review is not payment verification.

## Requirements and configuration

1. Create a Supabase project. Run `supabase/migrations/202611240001_initial.sql` in its SQL editor or apply it using the Supabase CLI. This creates rooms, staff roles, therapists, appointments, private receipt storage, RLS, and server-only transactional reservation functions. Confirm `btree_gist` is available.
2. Create a Netlify site connected to the GitHub repository. Set the repository base directory to this project if the repository contains a parent folder. `netlify.toml` publishes `dist` and uses `netlify/functions` for server functions. Do not publish `.env` or the service-role key.
3. Copy `.env.example` to `.env` for local development, and configure the same values in Netlify's environment-variable settings for Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the exact public `SITE_URL` without a trailing slash. The Supabase service-role key is a server-only secret that bypasses RLS; never put it in browser code or a public repository. Netlify Functions environment variables must be available to the Functions scope and require a new deployment after changes.
4. In Supabase Auth, disable unrestricted signup if appropriate and allow the Netlify site's `/staff.html` as an auth redirect URL. Create the first administrator in the Supabase Auth dashboard. Then run the following in the SQL editor with the real administrator email substituted:

```sql
insert into public.staff_roles(user_id, role)
select id, 'admin' from auth.users where email = 'administrator@example.com'
on conflict (user_id) do update set role = 'admin';
```

   Check that exactly one intended administrator was selected. This bootstrap must be done by the project owner through the Supabase dashboard; never expose it as a public endpoint. Administrators can invite staff through `/staff.html`; invite recipients must open the link and set a password. Set Supabase email settings and redirect URLs for invitations before use. Sign-in tokens are held only in the browser tab's memory; sign in again after a refresh or expiry.
5. If confirmation email is desired, set server-only `RESEND_API_KEY` and `RESEND_FROM` to a verified sender. Configure the sending domain and DNS as required by Resend. Leaving them blank deliberately disables mail. Provider acceptance is not a delivery guarantee. Booking/change results remain visible when email fails; customers must save their private management link.
6. Use a supported Node.js installation and the Netlify CLI to run `netlify dev` from the project directory after setting local environment variables. The management link uses `SITE_URL`, so set it to the local Netlify dev origin for local tests. To test email locally, configure a Resend test sender and a permitted test recipient as described by Resend, or leave the provider settings blank to test the failure path. Do not send real health information.

Documentation: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private storage](https://supabase.com/docs/guides/storage/security/access-control), [Netlify Functions environment variables](https://docs.netlify.com/build/functions/environment-variables/), and [Resend domains](https://resend.com/docs/dashboard/domains/introduction).

## Booking and staff behavior

- Customers complete the health declaration before choosing a service, choose a live available time, enter a name and email, upload a PNG/JPEG/PDF receipt (maximum 4 MB), review terms, and confirm. A private 256-bit management token is shown once and emailed if configured; only its SHA-256 hash is stored in the database. A lost link cannot be recovered by a booking reference alone. Anyone with the link can manage that appointment, so keep it private.
- The server calculates durations, capacities, room assignment and price. Database exclusion constraints prevent overlapping room reservations including cleaning, and overlapping therapist appointments. Times use Asia/Manila; a session may end at 9 PM with cleaning afterwards. Closing starts are added to the duration-based schedule. Cancellation and rescheduling within six hours are flagged. A successful reschedule clears the therapist assignment so staff can assign an available therapist for the new time.
- Authorized staff can view the daily room schedule, health declarations, receipts, assign therapists, review receipts and record payment amounts. The calendar refreshes by polling every 10 seconds when the dashboard is not being edited; it is not a push-based real-time subscription. Booked service value and amounts manually recorded by staff are reported separately. The dashboard invitation feature is administrator-only.
- All customer and staff actions are served by `/.netlify/functions/api`. Supabase anon/authenticated roles have no direct grants to the appointment tables or private receipt bucket; the function verifies Supabase staff identity and the `staff_roles` record before using the server-only key. Receipt access uses a 60-second signed URL. No health details are included in emails.

## Checks and remaining acceptance tests

Run `node --test tests/api.test.cjs` and `node --check` on scripts. The mock API tests cover family prices for 4–6, invalid guest counts, invalid receipts, unauthenticated dashboard access, the closing slot, and the email-disabled outcome. These mock checks do **not** prove database constraints, storage policies, authentication, email delivery, or browser behavior.

Before accepting or deploying the demonstration, use a separate configured test project and fictional data to verify:

1. Race two booking requests for the final room and verify exactly one succeeds; test that the 30-minute cleaning range blocks conflicts and a session can end at 9 PM.
2. Check availability and prices across all seven rooms; ensure seven guests are rejected and a positive health declaration requires details.
3. Check customer-link isolation, cancellation releasing a room, successful rescheduling releasing the original room, and failed rescheduling preserving it; verify late-change flags and policy messages.
4. Upload valid and invalid receipts; verify only authorized staff can get signed URLs and change receipt-review status. Confirm uploads alone do not count as recorded revenue.
5. Verify unauthorized and non-staff accounts cannot read appointment data or receipts, and staff cannot access administrator invitations. Test therapist overlap rejection.
6. Test emails with verified sender and permitted recipient, then remove or invalidate the email key and verify bookings/changes still succeed and report email failure.
7. Verify the dashboard, booking and management flows on desktop and mobile with keyboard navigation, focus visibility and reduced motion. Verify staff invites and initial password creation using the deployed Supabase Auth configuration.

No Supabase, Netlify, GitHub, or Resend account is configured by these files. SQL migrations, external integrations, concurrent booking behavior, and browser end-to-end flows must be tested against the actual configured services before claiming the system is ready.

## November 2026 booking and dashboard update

Apply `supabase/migrations/202611260001_booking_dashboard.sql` after the initial migration, then deploy the matching website and Netlify function together. Applying the migration removes the previous booking function signature, so schedule a short maintenance window between applying SQL and deploying the new code. Existing bookings retain an unspecified payment choice and may have no phone number.

New bookings require a 7–15 digit phone number and a choice of full payment or a 50% down payment. The displayed amount is an expected amount, not a verified payment. Only staff-recorded amounts are included as recorded payments. Admins can cancel appointments and put rooms into maintenance; rooms with current or future bookings cannot be switched to maintenance until those bookings are rescheduled or cancelled. Maintenance applies to new bookings and rescheduling, and does not cancel existing appointments. Monthly analytics use appointment dates in Asia/Manila; booked value excludes cancellations, while recorded payments include them.

Staff password recovery uses Supabase Auth email and redirects to `/staff.html`; the URL must be allowed in Supabase Auth settings. Reset delivery requires working Auth email configuration and is subject to provider and Supabase restrictions. Admin cancellations attempt a notification, but the dashboard indicates if email was not sent. Test these flows against a separate Supabase project before use, including concurrent booking versus maintenance, cancellation, email failures, password reset and room availability.

## Gmail for customer booking emails

The Supabase Auth SMTP settings are separate from the Netlify function. To send customer booking, cancellation and rescheduling confirmations using Gmail, set `GMAIL_SMTP_USER` to the complete Gmail address and `GMAIL_SMTP_APP_PASSWORD` to a Google app password in Netlify environment variables with Functions scope. Mark the app password secret, keep it out of Git, and redeploy after changing variables. The account needs Google 2-Step Verification and permission to use app passwords. A dedicated mailbox is recommended. Supabase Auth still needs its own SMTP configuration for staff invitations and password resets.

Gmail is preferred when both Gmail settings are present; otherwise the existing optional Resend configuration is used. If email cannot be sent, the database action stays saved and the visitor is told to keep the private management link. Provider acceptance does not guarantee delivery. Email and receipt uploads do not prove payment; receipt files are available to authorized staff and are not emailed. Test with fictional data and a permitted test recipient.

## Payment confirmation email

Apply `supabase/migrations/202611260002_receipt_email.sql` before deploying the matching function. When staff mark a receipt reviewed and record a positive payment amount (in either order), the server attempts a payment confirmation email; it does not attach the uploaded receipt. The dashboard reports provider acceptance or failure and offers a retry. SMTP acceptance is not proof of inbox delivery. Claiming prevents concurrent duplicate sends for the same amount; a timeout after provider acceptance can leave the outcome uncertain, so check the inbox before retrying. Updates to previously saved appointments are not emailed until staff update receipt review or payment or explicitly retry.

## Branded staff invitations

Supabase Auth sends invitations separately from customer emails. In the hosted Supabase dashboard, open Authentication → Emails → Templates → Invite user and paste the contents of `supabase/templates/invite.html` into the invitation body, with subject `You’re invited to Bella Vista Oasis Spa`. Save and test using a fictional or authorized test account. Keep `{{ .ConfirmationURL }}` unchanged; Supabase fills in the one-time invitation link. This repository file alone does not change the hosted Supabase template. The invitation contains no password. Customer email templates use `netlify/lib/email-templates.js` and include both HTML and plain-text versions.
