import { Role, type Artifact, type Message, type Part } from "@a2a-js/sdk";

// SDK side shapes for the customer agent executor. These are @a2a-js/sdk internal types (`content.$case` parts,
// numeric TaskState), never wire JSON: the JsonRpcTransportHandler converts (09 "SDK 함정" 1). The clinic and
// platform modules have their own copies; agent modules do not import each other.

export function dataPart(value: Record<string, unknown>): Part {
  return { content: { $case: "data", value }, metadata: undefined, filename: "", mediaType: "application/json" };
}

export function textPart(value: string): Part {
  return { content: { $case: "text", value }, metadata: undefined, filename: "", mediaType: "text/plain" };
}

/** A data result: the pibu/*@1 object in parts[0] (03 "응답 형태 규칙"), artifactId always set. */
export function dataArtifact(artifactId: string, name: string, value: Record<string, unknown>): Artifact {
  return { artifactId, name, description: "", parts: [dataPart(value)], metadata: undefined, extensions: [] };
}

/** A text confirmation result (customer.notify): parts[0].text. */
export function textArtifact(artifactId: string, name: string, text: string): Artifact {
  return { artifactId, name, description: "", parts: [textPart(text)], metadata: undefined, extensions: [] };
}

function agentMessage(taskId: string, contextId: string, parts: Part[]): Message {
  return {
    messageId: crypto.randomUUID(),
    contextId,
    taskId,
    role: Role.ROLE_AGENT,
    parts,
    metadata: undefined,
    extensions: [],
    referenceTaskIds: [],
  };
}

export const agentTextMessage = (taskId: string, contextId: string, text: string): Message =>
  agentMessage(taskId, contextId, [textPart(text)]);

/** A DataPart first and an optional text line, e.g. pibu/input-request@1 in status.message. */
export const agentDataMessage = (taskId: string, contextId: string, value: Record<string, unknown>, text?: string): Message =>
  agentMessage(taskId, contextId, text === undefined ? [dataPart(value)] : [dataPart(value), textPart(text)]);

/** The value of the first DataPart of a message, or undefined. */
export function firstDataValue(message: Pick<Message, "parts"> | undefined): unknown {
  for (const part of message?.parts ?? []) {
    if (part.content?.$case === "data") return part.content.value;
  }
  return undefined;
}
