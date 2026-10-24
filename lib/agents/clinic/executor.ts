import type { AgentExecutor } from "@a2a-js/sdk/server";
import type { ClinicRegistryEntry } from "../../domain";
import { notImplementedExecutor } from "../../a2a/stub-executor";

// Clinic agent executor, one per clinic, served at /a2a/clinics/{slug}/rpc (app/a2a/clinics/[slug]/rpc/route.ts).
// The route resolves the clinic from the platform registry and passes its entry here.
// T04 stub: every skill answers TASK_STATE_FAILED. WP3 (T05) replaces this file with the real skills.
export const clinicExecutor = (clinic: ClinicRegistryEntry): AgentExecutor => {
  void clinic;
  return notImplementedExecutor();
};
