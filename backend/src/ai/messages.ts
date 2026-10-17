import type { AiFailure } from "./model";

// What the user is told when the AI service refuses a request (Vietnamese source text, translated by the client).
export const AI_FAILURE_MESSAGES: Record<NonNullable<AiFailure>, string> = {
  auth: "Khóa API của trợ lý AI không hợp lệ. Hãy báo cho quản trị viên.",
  billing: "Tài khoản của trợ lý AI đã hết tín dụng. Hãy báo cho quản trị viên.",
  busy: "Trợ lý AI đang quá tải. Hãy thử lại sau ít phút.",
};
