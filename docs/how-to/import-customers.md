# Import customers from a CSV

Goal: load many customers at once, and understand what happened to the rows that
could not be loaded.

## The shape of the file

The importer takes rows, not a file: the API receives parsed rows and validates
each one. A CSV is therefore a client-side concern — the web app parses the text
and posts rows.

Column order does not matter, and the header is required. Each row needs:

| Column | Rule |
| --- | --- |
| `name` | non-empty |
| `email` | must look like an address, and must be new |
| `country` | at least two characters |
| `status` | `active`, `inactive` or `churned` |
| `totalTransactions` | a whole number, zero or more |
| `totalAmountSpent` | a number, zero or more |
| `lastActivityDate` | `YYYY-MM-DD` |

## From the app

**Customers → Import customers**, choose a `.csv`, select **Import**. The result
panel reports how many rows were imported, how many were duplicates of existing
customers, and lists each rejected row with the line number to fix.

## From the API

```bash
curl -X POST http://localhost:4000/api/v1/customers/import \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"customers":[
        {"name":"Awa Diop","email":"awa@example.com","country":"Senegal","status":"active","totalTransactions":4,"totalAmountSpent":129.5,"lastActivityDate":"2026-09-30"},
        {"name":"Bad Row","email":"not-an-email","country":"CI","status":"active","totalTransactions":1,"totalAmountSpent":10,"lastActivityDate":"2026-01-01"}
      ]}'
```

```json
{
  "imported": 1,
  "duplicates": 0,
  "failures": [{ "row": 2, "reason": "email must be a valid address" }]
}
```

## Notes

- **The import is partial by design.** One bad line does not fail the file: valid
  rows are stored, and each rejected row is reported with its 1-based position so
  you can fix the source.
- **Rejected rows are not stored.** A row either exists completely or not at all,
  so a retry cannot produce a half-written customer.
- **`row` is a position in the submitted array**, not a CSV line number. The web
  app keeps the two in step and reports the line you can actually edit.
