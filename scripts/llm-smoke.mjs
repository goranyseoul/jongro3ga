// Checks that the LLM layer can reach Claude with the key in .env: one short structured call.
// Usage: node --env-file=.env scripts/llm-smoke.mjs   (exit 0 = live call worked)

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("ANTHROPIC_API_KEY is empty in .env");
  process.exit(2);
}
const model = process.env.CLAUDE_MODEL_FAST || "claude-haiku-5-5";
const body = JSON.stringify({
  model,
  max_tokens: 64,
  messages: [{ role: "user", content: "Reply with the single word: ready" }],
});
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
  body,
});
const json = await res.json();
if (!res.ok) {
  console.error(`Claude answered ${res.status}:`, JSON.stringify(json).slice(0, 300));
  process.exit(1);
}
const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
console.log(`live OK (${model}): ${text.trim()}`);
