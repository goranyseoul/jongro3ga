import { Role, type Artifact, type Message, type Part } from "@a2a-js/sdk";
import { agentTextMessage } from "../../a2a/stub-executor";

// SDK side shapes for the clinic agent. These are @a2a-js/sdk internal types (`content.$case` parts, numeric
// TaskState), never wire JSON: the JsonRpcTransportHandler converts (09 "SDK 함정" 1).

export { agentTextMessage };

export function dataPart(value: Record<string, unknown>): Part {
  return { content: { $case: "data", value }, metadata: undefined, filename: "", mediaType: "application/json" };
}

export function textPart(value: string): Part {
  return { content: { $case: "text", value }, metadata: undefined, filename: "", mediaType: "text/plain" };
}

/** A result artifact: the pibu/*@1 object in parts[0] (03 "응답 형태 규칙"), artifactId always set. */
export function dataArtifact(artifactId: string, name: string, value: Record<string, unknown>): Artifact {
  return { artifactId, name, description: "", parts: [dataPart(value)], metadata: undefined, extensions: [] };
}

/** An agent message with a DataPart first and an optional text line, e.g. pibu/input-request@1. */
export function agentDataMessage(taskId: string, contextId: string, value: Record<string, unknown>, text?: string): Message {
  return {
    messageId: crypto.randomUUID(),
    contextId,
    taskId,
    role: Role.ROLE_AGENT,
    parts: text === undefined ? [dataPart(value)] : [dataPart(value), textPart(text)],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: [],
  };
}

/** The value of the first DataPart of a message, or undefined. */
export function firstDataValue(message: Pick<Message, "parts">): unknown {
  for (const part of message.parts ?? []) {
    if (part.content?.$case === "data") return part.content.value;
  }
  return undefined;
}

/** A short random id with a prefix that satisfies the wire id patterns (`qt_`, `bkg_`). */
export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
