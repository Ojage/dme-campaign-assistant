# Build a segment

Goal: define an audience, check its size before saving it, and save it for reuse.

## The rules

- Each condition is one field, one operator and one value.
- **All conditions must hold** — they are combined with AND.
- Three fields compare numbers (`totalAmountSpent`, `totalTransactions`,
  `lastActivityDays`) and accept `gt`, `lt` or `eq`.
- `country` compares text and accepts `eq` only: there is no meaningful ordering
  of country names, so the contract, the builder and the API all reject anything
  else with a `validation_failed` problem.

## In the app

1. Open **Segments** and select **New segment**.
2. Give it a name.
3. Choose a field, an operator, and type a threshold.
4. Read the audience size. It updates as you type, before anything is saved —
   the API counts matching customers for unsaved conditions.
5. Add further conditions to narrow the audience.
6. Save.

## From the API

Count an audience first:

```bash
curl -X POST http://localhost:4000/api/v1/segments/preview \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"conditions":[{"field":"lastActivityDays","operator":"gt","value":90}]}'
```

```json
{ "matchCount": 41 }
```

Then save it:

```bash
curl -X POST http://localhost:4000/api/v1/segments \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Dormant 90 days","conditions":[{"field":"lastActivityDays","operator":"gt","value":90}]}'
```

The saved segment carries its conditions, so it stays readable and editable later.

## Notes

- **A segment with no conditions is refused.** An empty audience is almost always
  a mistake, and a segment that matches everything is rarely what was meant.
- **The stored audience size is a snapshot.** It was true when the segment was
  written; customer activity changes. The composer re-counts when you preview.
- **Deleting a segment does not touch campaigns generated from it.** Each campaign
  keeps its own copy of the segment name, so past work stays legible.
