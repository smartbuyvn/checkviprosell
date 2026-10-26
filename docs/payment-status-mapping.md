# Payment Status Mapping Truth

Transactions generated via `POST /api/v1/billing/checkout` immediately exist as headless URL redirects on the client. Database mapping occurs *exclusively* upon Webhook interaction.

### Status Table Flow
| Condition | Stripe Event | Database Mapping | Consequence |
|---|---|---|---|
| Card Captured | `checkout.session.completed` | `payments.status = 'paid'` | Credits strictly granted to `userId`. Pending Affiliation populated. |
| Bank Reject | `checkout.session.async_payment_failed` | `payments.status = 'failed'` | N/A |
| Reversal | `charge.refunded` | `payments.status = 'refunded'` | Active affiliations flagged `rejected` (`reason: payment_refunded_reversal`). |

### History Truth
`GET /api/v1/billing/history` maps fields cleanly:
- `provider`: strictly `'stripe'`
- `providerTxnId`: strictly the `paymentIntent.id` (not `session.id`, ensuring `charge.refunded` traverses properly).
- `amount`: divided natively by 100 capturing Vietnamese Dong zero-decimal standards.
