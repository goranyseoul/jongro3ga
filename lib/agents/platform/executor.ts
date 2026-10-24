import type { AgentExecutor } from "@a2a-js/sdk/server";
import { notImplementedExecutor } from "../../a2a/stub-executor";

// Platform agent executor, served at /a2a/platform/rpc (app/a2a/platform/rpc/route.ts).
// T04 stub: every skill answers TASK_STATE_FAILED. WP4 (T06) replaces this file with the real skills.
export const platformExecutor = (): AgentExecutor => notImplementedExecutor();
