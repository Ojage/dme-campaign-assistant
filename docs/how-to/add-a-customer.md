# Add a customer

Goal: create one customer and see every screen that shows customers reflect it.

## In the app

1. Open **Customers**.
2. Select **Add customer**.
3. Fill in the name, email, country, status, transaction count, total amount spent
   and last activity date.
4. Save.

The new row appears in the table, the total on the dashboard changes, and the
audience counts of any segment that matches them are recomputed on the next
preview.

## From the API

```bash
curl -X POST http://localhost:4000/api/v1/customers \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "name": "Awa Diop",
    "email": "awa.diop@example.com",
    "country": "Senegal",
    "status": "active",
    "totalTransactions": 4,
    "totalAmountSpent": 129.5,
    "lastActivityDate": "2026-09-30"
  }'
```

## Notes

- **A duplicate email is refused**, not merged: the API answers `409 conflict` so
  you decide what should happen. This keeps an accidental re-import from
  overwriting a customer's history.
- **An invalid field is refused with `400`** and a `problems[].errors` entry
  naming the field, so a form can put the message next to the input.
- **Unknown fields are ignored** rather than rejected, so a newer client sending
  extra data still works against an older API. See
  [versioning](../explanation/api-versioning.md).
