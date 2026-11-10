# Offline complaint classification baseline

Run `npm run ops:evaluate-classifier` after `npm ci`. The command runs the same deterministic classifier used by intake against [30 original synthetic complaints](../scripts/travel-classifier-cases.json), five per category. Labels reflect the traveler’s primary requested outcome. The fixture includes indirect wording, overlapping terms, and complaints that should remain in Other. It contains no live records or Bitext examples and uses no database, network or provider key.

The current classifier matched **16 of 30 labels (53.3%)**. This is an intentionally small challenge set written after the rules existed. The result is a development baseline and does not estimate production accuracy.

| Category | Correct |
| --- | ---: |
| Refund | 3/5 |
| Cancellation | 2/5 |
| Booking change | 3/5 |
| Check-in | 3/5 |
| Baggage | 2/5 |
| Other | 3/5 |

The evaluator prints mismatched row numbers and labels. The main misses involve paraphrases such as “reverse the charge” and “suitcase”, negation such as “I don't want a refund”, and overlapping words such as “check-in” in a request to move a booking.

Before comparing a new classifier or provider, write a separate evaluation set and keep it out of development. Measure category errors, invalid output and abstention separately. Run independent access and booking-linking checks against the real API. A classification suggestion must never authorize a booking link or override verified facts. Provider selection, redaction and live model evaluation remain open under [issue #8](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/8).
