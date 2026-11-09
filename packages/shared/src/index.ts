// TicketStatus previously lived here directly; moved to ./enums so
// demo-data/ (which also needs it) doesn't have to import back through
// this barrel file and create a circular import. Still re-exported here
// unchanged, so `@helpdesk/shared`'s public API doesn't change.
export type { Role, TicketStatus, TicketPriority } from './enums';
export type { TravelInsights } from './travel-insights';

export { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from './auth-config';

export type { ApiErrorCode } from './api-error-codes';
export { API_ERROR_CODES } from './api-error-codes';

export type { DemoUser, DemoTicket, DemoMessage } from './demo-data';
export {
  DEMO_PASSWORD,
  DEMO_USERS,
  DEMO_TICKETS,
  DEMO_MESSAGES,
  DEMO_USER_IDS,
  isDemoUserId,
  daysAgo,
} from './demo-data';

export { containsEmoji } from './validation/no-emoji';
export {
  isValidName,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
} from './validation/name';
export {
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  hasMinLength,
  hasUppercase,
  hasLowercase,
  hasDigit,
  hasSpecialChar,
} from './validation/password';
export { isCommonPassword } from './validation/common-passwords';
export { EMAIL_MAX_LENGTH } from './validation/email';
export {
  TICKET_TITLE_MIN_LENGTH,
  TICKET_TITLE_MAX_LENGTH,
  TICKET_DESCRIPTION_MIN_LENGTH,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_CLOSE_REASON_MIN_LENGTH,
  TICKET_CLOSE_REASON_MAX_LENGTH,
  TICKET_MESSAGE_CONTENT_MIN_LENGTH,
  TICKET_MESSAGE_CONTENT_MAX_LENGTH,
  TICKET_REOPEN_REASON_MIN_LENGTH,
  TICKET_REOPEN_REASON_MAX_LENGTH,
} from './validation/ticket';

export type {
  PaginatedResult,
  TicketSortableField,
  SortOrder,
} from './pagination';
export {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TICKET_SORTABLE_FIELDS,
  DEFAULT_TICKET_SORT_BY,
  SORT_ORDERS,
  DEFAULT_SORT_ORDER,
} from './pagination';

export type {
  AiChatRole,
  AiChatResponse,
  AiChatMessageResult,
  AiChatTicketCreatedResult,
  AiUsageResponse,
} from './ai-chat';
export {
  AI_CHAT_ROLES,
  AI_CHAT_MESSAGE_MIN_LENGTH,
  AI_CHAT_MESSAGE_MAX_LENGTH,
  AI_CHAT_MAX_TRANSCRIPT_MESSAGES,
} from './ai-chat';
