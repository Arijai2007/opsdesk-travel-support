# Offline complaint classification baseline

Run `npm run ops:evaluate-classifier` after `npm ci`. The command runs the same deterministic classifier used by intake against [30 original synthetic complaints](../scripts/travel-classifier-cases.json), five per category. Labels reflect the traveler’s primary requested outcome. The fixture includes indirect wording, overlapping terms, and complaints that should remain in Other. It contains no live records or Bitext examples and uses no database, network or provider key.

The original rules matched **16 of 30 labels (53.3%)**. The revised rules matched **27 of 30 (90.0%)** on the same development fixture. This small challenge set does not estimate production accuracy.

| Category | Original | Revised |
| --- | ---: | ---: |
| Refund | 3/5 | 5/5 |
| Cancellation | 2/5 | 4/5 |
| Booking change | 3/5 | 5/5 |
| Check-in | 3/5 | 3/5 |
| Baggage | 2/5 | 5/5 |
| Other | 3/5 | 5/5 |

Run `npm run ops:evaluate-classifier -- --holdout` for a second [18-case synthetic fixture](../scripts/travel-classifier-holdout.json) written before the rule change. The original rules matched **6/18** and the revised rules matched **17/18**. The evaluator prints mismatched row numbers and labels. The remaining misses include implicit cancellation and airport or hotel access problems without a check-in keyword.

Both fixtures were authored by the same contributor and are now visible in the repository. Before selecting a provider, use an independently labeled set kept out of development. Measure category errors, invalid output and abstention separately. Run independent access and booking-linking checks against the real API. Classification does not authorize booking links or override verified facts. Provider selection, redaction and live model evaluation remain open under [issue #8](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/8).
