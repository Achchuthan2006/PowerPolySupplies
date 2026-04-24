# Email Deliverability Setup

This project can now send cleaner transactional emails, but Inbox placement depends mostly on domain authentication and sender reputation.

For `powerpolysupplies.com`, the professional setup should be:

1. Send from your own domain
2. Authenticate that domain with SPF, DKIM, and DMARC
3. Use a transactional sender for website emails
4. Keep `Reply-To` pointed at a monitored mailbox

## Recommended sender addresses

Use these addresses for website-generated email:

- `EMAIL_FROM=no-reply@powerpolysupplies.com`
- `EMAIL_REPLY_TO=orders@powerpolysupplies.com`
- `EMAIL_ENVELOPE_FROM=bounces@powerpolysupplies.com`
- `ORDER_TO=orders@powerpolysupplies.com`

Do not use `powerpolysupplies@gmail.com` as the `From` address for transactional mail if Inbox placement matters.

## Recommended provider

Use SendGrid with a verified sender domain.

The backend already supports:

- `SENDGRID_API_KEY`
- `SENDGRID_FROM`

Recommended values:

- `SENDGRID_FROM=no-reply@powerpolysupplies.com`
- `EMAIL_FROM=no-reply@powerpolysupplies.com`
- `EMAIL_REPLY_TO=orders@powerpolysupplies.com`
- `EMAIL_ENVELOPE_FROM=bounces@powerpolysupplies.com`

## DNS records to publish

These are the records you should add in your DNS provider for `powerpolysupplies.com`.

### SPF

Only keep one SPF record for the root domain.

If you send only through SendGrid:

```dns
Type: TXT
Host: @
Value: v=spf1 include:sendgrid.net ~all
```

If you also send from Google Workspace mailboxes:

```dns
Type: TXT
Host: @
Value: v=spf1 include:_spf.google.com include:sendgrid.net ~all
```

### DKIM

Enable DKIM inside SendGrid and publish the CNAME records it gives you.

They usually look like:

```dns
Type: CNAME
Host: s1._domainkey
Value: s1.domainkey.u123456.wl.sendgrid.net

Type: CNAME
Host: s2._domainkey
Value: s2.domainkey.u123456.wl.sendgrid.net
```

The exact values must come from your SendGrid account.

### DMARC

Start with monitoring mode first:

```dns
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@powerpolysupplies.com; ruf=mailto:dmarc@powerpolysupplies.com; adkim=s; aspf=s; pct=100
```

After SPF and DKIM are passing consistently, move to:

```dns
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@powerpolysupplies.com; ruf=mailto:dmarc@powerpolysupplies.com; adkim=s; aspf=s; pct=100
```

Eventually, if everything is healthy:

```dns
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=reject; rua=mailto:dmarc@powerpolysupplies.com; ruf=mailto:dmarc@powerpolysupplies.com; adkim=s; aspf=s; pct=100
```

## Mailbox setup

Create or verify these inboxes:

- `orders@powerpolysupplies.com`
- `no-reply@powerpolysupplies.com`
- `bounces@powerpolysupplies.com`
- `dmarc@powerpolysupplies.com`

At minimum, make sure `orders@powerpolysupplies.com` is a real monitored mailbox.

## Backend env example

```env
EMAIL_FROM=no-reply@powerpolysupplies.com
EMAIL_REPLY_TO=orders@powerpolysupplies.com
EMAIL_ENVELOPE_FROM=bounces@powerpolysupplies.com
ORDER_TO=orders@powerpolysupplies.com

SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM=no-reply@powerpolysupplies.com
```

If you still want SMTP as a backup:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

## Professional sending rules

- Use a branded `From` address on your own domain
- Keep the same sending domain for all order and contact mail
- Do not send transactional website mail from a free Gmail sender
- Avoid spammy wording in subject lines
- Keep HTML emails paired with plain-text content
- Keep reply handling on a monitored inbox
- Warm up the sending domain slowly if volume increases

## What was already improved in code

The backend now:

- generates plain-text email content automatically
- sets cleaner `Reply-To`
- supports envelope sender configuration
- sends more consistent headers and message IDs

Files updated:

- `backend/server.js`
- `backend/.env.example`
- `frontend/README_DEPLOY.md`

## Final note

Inbox placement cannot be guaranteed by code alone.

The biggest improvement will come from:

1. sending as `@powerpolysupplies.com`
2. authenticating the domain correctly
3. using SendGrid with verified domain authentication
