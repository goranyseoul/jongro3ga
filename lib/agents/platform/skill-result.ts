import type { AgentRole } from "../../domain";

// What a text skill hands back to the executor: the terminal task state and the text for the artifact
// (completed) or the status message (rejected, failed), 03 "응답 형태 규칙" and "에러 처리".

export type TextResult = { state: "completed" | "rejected" | "failed"; text: string };

export const completed = (text: string): TextResult => ({ state: "completed", text });
export const rejected = (text: string): TextResult => ({ state: "rejected", text });
export const failed = (text: string): TextResult => ({ state: "failed", text });

/** The authenticated caller: `sub` and `role` of its agent token. */
export interface SkillCaller {
  agentId: string;
  role: AgentRole;
}
