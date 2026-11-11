# Accessibility and classifier review

These are review procedures and tooling, not completed acceptance. Deployment remains paused.

## Reviewer-labelled classifier evaluation

The existing 30 development and 18 holdout examples are synthetic regression fixtures. Their scores do not establish independent acceptance. The evaluator now also accepts a local, reviewer-labelled JSON dataset without changing the classifier rules.

### Local blind review form

Run `npm run ops:review-classifier` on Node 22.23.x, then open [the local review form](http://127.0.0.1:3330). It needs neither the OpsDesk preview/database nor model credentials. Set `OPSDESK_REVIEW_PORT` to a different port from 1024 to 65535 if needed. The server binds only to `127.0.0.1` and serves a fixed set of read-only assets; no upload or save endpoint is available.

The form loads the existing **unlabelled synthetic** 18-example pack. Choose a primary category and record a rationale for each example. Previous/Next and the example selector preserve edits and announce the new example through heading focus. Import an existing draft or another version-1 dataset using the file picker (up to 2 MiB). Files are parsed in the browser; imported complaint text is displayed as text. No predictions, scoring or external service calls occur.

Download a draft at any point to preserve incomplete labels and reviewer fields. No automatic persistence is used; download before closing the tab. Replacing edited work asks before discarding it. Drafts can be imported again, but the independence checkbox must be confirmed again for a final export.

The reviewed export requires every category/rationale, dataset name/source, a reviewer identifier, review notes, coverage of all six categories and an explicit declaration that labels were assigned without viewing predictions. Shared evaluator validation also rejects normalized duplicate text and duplicate IDs. The export sets a fresh ISO UTC timestamp and records the reviewer's declaration in the notes. It preserves source attribution. Neither the checkbox nor valid JSON proves independent acceptance. The evaluator still applies its existing-fixture overlap guard when scoring; the form does not load the answer fixtures or classifier rules.

Save completed files under the ignored `.opsdesk/` directory, freeze/hash them, and follow the evaluation procedure below. Human review and adjudication remain necessary. Run `npm run ops:test:review-form` for the standalone server/browser tests. The standard browser command also runs them, using its selected Chromium or Firefox engine.

### Evaluation procedure

1. Choose a reviewer who has not used the classifier predictions to assign labels. Prefer independently collected, approved, de-identified travel complaints with documented source and usage rights. Keep private inputs and reports under the ignored `.opsdesk/` directory; do not commit customer records or reviewer personal details.
2. Freeze the category rubric and data selection before scoring. Use the customer's primary requested action: `REFUND` for returning a payment, `CANCELLATION` for ending a reservation, `BOOKING_CHANGE` for amending an existing reservation, `CHECK_IN` for gaining access/boarding at arrival, `BAGGAGE` for baggage handling or policy, and `OTHER` for remaining requests. Record ambiguity decisions and secondary intents in the rationale. Have a second reviewer adjudicate disagreements before running predictions. Do not silently drop difficult examples.
3. Copy `scripts/fixtures/travel-classifier-review.json` to `.opsdesk/reviewed-classifier.json` as a starting format. The supplied 18 examples are assistant-authored synthetic wording with blank labels, not independently sourced or labelled data. A human can label this starter for an initial review, but representative customer evaluation still remains open. Do not inspect `travel.rules.ts`, synthetic answer fixtures or predictions while labelling.
4. Fill every example's `label` and `rationale`. Fill `labelledBy` with an approved reviewer identifier, `labelledAt` with a valid UTC timestamp such as `2026-11-11T16:30:00.000Z`, and `reviewNotes` with the rubric/version, independence declaration and adjudication details. Replace the source declaration when using a different dataset. Include every category; report the actual distribution instead of calling a balanced pack representative traffic.
5. Freeze the labelled file and record its SHA-256 before prediction. Run from the repository root on Node 22.23.x:

   ```text
   npm run ops:evaluate-classifier -- --dataset .opsdesk/reviewed-classifier.json
   npm run --silent ops:evaluate-classifier -- --dataset .opsdesk/reviewed-classifier.json --json
   ```

The JSON mode emits dataset/rule hashes, declared provenance, Node version, timestamp, accuracy, macro F1, per-category precision/recall/F1/support, a confusion matrix (expected rows, predicted columns), and error IDs. It omits complaint text, though provenance may itself contain private information. Zero predicted examples produce precision/F1 zero. The new mode rejects duplicate normalized text/IDs, overlap with the existing synthetic fixtures, incomplete metadata, missing labels/rationales and missing category coverage. Normalized equality is only an exact-overlap guard; reviewers must check semantic duplicates, source leakage and whether labels were assigned independently. Metadata cannot prove independence.

`--check` retains its original fixed-fixture thresholds and cannot be combined with `--dataset`. A valid dataset run exits successfully even with low accuracy: targets have not been agreed, so successful execution is not acceptance. Review all errors and approve category-specific targets before accepting a model. Once a dataset has informed rule tuning, retire it as an untouched holdout and obtain a fresh one. This command evaluates classification only; privacy/linking and grounded summary/draft evaluation remain separate work.

Run the evaluator's focused tests with `npm run ops:test:classifier`. They also run before the backend/API suite through `npm run ops:test`. They use synthetic test data solely to verify input rejection, scoring and report generation.

## Observable screen-reader review

Use the isolated synthetic preview and a screen reader/browser combination that exposes actual speech or a speech transcript. Record OS, browser, screen-reader version, role, theme, exact navigation, expected meaning, actual utterance, result and evidence location. An accessibility tree, focus assertion or axe result cannot establish spoken output.

For each manager, agency, customer, agent and supplier workspace, record:

| Interaction | What the reviewer must observe |
| --- | --- |
| Open workspace and navigate headings/landmarks | Meaningful page/workspace names, role context and a navigable reading order. |
| Navigate the queue or customer booking cards | Useful case/booking names, states and supported actions without decorative clutter. |
| Open and close a supported dialog | Dialog name, initial focus announcement, Tab/Shift+Tab containment, Escape dismissal and announced focus return. |
| Submit an incomplete form, then correct it | Field labels, required/invalid states and errors associated with the relevant controls. |
| Open Notifications and dismiss with Escape | Panel context, readable entries and return to the triggering control. |
| Read customer/internal/supplier conversation states in the permitted role | Thread identity and message context remain clear; restricted content is absent. |
| Load case history and complete a synthetic action | Loading, success and failure feedback are perceivable; focus stays usable. |

Use supported actions for each role; do not invent unavailable supplier/customer controls. Include light and dark themes and an actual browser zoom check when it changes the interaction under review. Prior customer Chrome 200%/400% zoom results remain historical evidence and are not new screen-reader evidence.

On this continuation's Windows machine, the computer-use app inventory exposed no NVDA entry. Built-in Narrator launched, but its captured window reported higher Windows integrity than the helper. No OpsDesk spoken-output transcript/audio was observed. Acceptance remains unverified; complete the review with a working observable setup or a human reviewer.
