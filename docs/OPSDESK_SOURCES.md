# Sources and implementation notes

## Code foundation

- IT Helpdesk: https://github.com/Molnar-Zoltan/it-helpdesk - retained Next.js/NestJS monorepo, auth, cookie proxy, PostgreSQL/Prisma, base ticketing and Gemini code. New travel-domain tables and endpoints live under `backend/src/travel` and `backend/prisma`; OpsDesk UI is in `frontend/components/opsdesk`.
- Chatwoot: https://github.com/chatwoot/chatwoot - reference for shared-inbox interaction patterns, private notes and connected history. No Chatwoot source files were copied into this implementation.
- Open HelpDesk: https://github.com/Open-HelpDesk/open-helpdesk - reference for SLA and supplier/email workflow design. No Open HelpDesk source files were copied.

## Dataset attribution

Author: **Bitext**. Source: https://huggingface.co/datasets/bitext/Bitext-travel-llm-chatbot-training-dataset

Dataset license: **Community Data License Agreement - Sharing 1.0 (CDLA-Sharing-1.0)**, https://cdla.dev/sharing-1-0/

The included `frontend/public/data/travel-examples.json` is a derived sample: up to two instructions per intent, selected from the CSV with a simple profanity filter. Only `instruction`, `intent` and `category` are retained. Original response templates are excluded. The sample retains source and license metadata and is supplied under the source dataset's CDLA-Sharing-1.0 terms. The sample is not evidence of AI training, operational history or supplier-specific refund policies.

Additional evaluation reference: https://huggingface.co/datasets/bitext/Bitext-customer-support-llm-chatbot-training-dataset - not bundled or used for a measured model benchmark in this version.

## Architecture decisions

- Travel records use normalized PostgreSQL tables instead of browser localStorage. Existing generic IT-ticket tables remain separate to avoid inheriting unsuitable access assumptions for agency/customer/supplier conversations.
- Travel profiles map the inherited user identity to CUSTOMER, AGENCY, AGENT, MANAGER or SUPPLIER. Authorization uses the stored profile, not a browser-supplied role.
- Agency and customer checks precede reference linking. Supplier accounts cannot access the ticket workspace or its history, only explicitly shared supplier conversations.
- All timestamps are UTC in application persistence. Booking timezone is retained for travel-local display. SQL tests use explicit UTC conversion when writing Prisma timestamp fields.
- State-changing routing and escalation use a PostgreSQL transaction advisory lock. Escalation keys include the case/conversation and relevant deadline, enabling repeat-safe checks across worker restarts.
- Gemini integration from upstream remains optional. Record summaries and deterministic rules keep the demo usable without model credentials.

## Work remaining beyond the prototype

Real email delivery/ingestion and verified message threading; attachment handling; production multi-workspace onboarding and migration; configurable supplier contracts and team/skill policies; an optional grounded LLM adapter with evaluation; pagination and reporting at larger scale; production deployment and operational hardening.
