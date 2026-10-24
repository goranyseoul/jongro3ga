// platform.recipe skill handler. OWNER: track LLM (data/seed/kr-patterns.json + recipe logic).
// The A2A core registers it in ./definition.ts; this stub keeps that import compiling.
import type { SkillHandler } from "@/lib/a2a/contract";

export const recipeSkill: SkillHandler = async () => ({ state: "TASK_STATE_FAILED", text: "recipe not implemented yet" });
