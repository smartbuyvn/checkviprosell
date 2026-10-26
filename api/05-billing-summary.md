# Viprosell â€” BILLING SUMMARY CONTRACT
**Phase:** 12 â€” Launch Freeze

## Endpoint: GET `/api/billing/summary`
Source of truth for all billing-related frontend behaviors. Discards legacy history logic by providing a canonical object model combining plan, transactions, and verifiable recipt documents.

**Access restrictions:** Authenticated User (Own-data only).

### Response Envelope
```json
{
  "currentPlan": {
    "planCode": "pro",
    "name": "GÃ³i Pro",
    "expiresAt": null
  },
  "payments": [
    {
      "id": "uuid",
      "created_at": "ISO",
      "plan_code": "pro",
      "amount": 29.99,
      "currency": "USD",
      "status": "paid",
      "payment_method": "card",
      "provider_txn_id": "pi_123",
      "receipt_url": "https://pay.stripe.com/receipts/...",
      "invoice_url": null
    }
  ],
  "invoices": [
     {
        "id": "uuid",
        "paymentId": "uuid",
        "label": "HÃ³a Ä‘Æ¡n gÃ³i PRO",
        "url": "https://pay.stripe.com/receipts/...",
        "issuedAt": "ISO"
     }
  ]
}
```

## Derivation Rules
1. **`currentPlan`**: Derived intelligently purely from backend lookup. It parses the descending list of paid transactions and binds the `plan_code` assigned. Missing or 'refunded' logs instantly nullify the package.
2. **`invoices`**: An explicit array mapping over real `receipt_url`s and `invoice_url`s caught during Stripe's webhook enrichment. Hardcoded falsification is forbidden.
3. **Webhook Updates**: Relies on a bi-event reconciliation architecture. 
    - `checkout.session.completed` strictly grants initial ledger fulfillment and row creation.
    - `charge.succeeded` updates native receipt documents dynamically without corrupting base logs.
