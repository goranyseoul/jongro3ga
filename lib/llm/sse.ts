// Server-Sent Events framing shared by the onboarding route (encode) and the chat screen (decode).
// The route answers a POST, so the browser reads the stream with fetch, not EventSource.

export interface SseMessage {
  event: string;
  data: unknown;
}

export function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Parses complete frames from `buffer`, returning them and the unfinished rest. */
export function parseSseFrames(buffer: string): { messages: SseMessage[]; rest: string } {
  const messages: SseMessage[] = [];
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  for (const frame of frames) {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) continue;
    try {
      messages.push({ event, data: JSON.parse(data.join("\n")) });
    } catch {
      // a malformed frame is dropped, the rest of the stream still renders
    }
  }
  return { messages, rest };
}

/** Reads an SSE response body to the end, calling `onMessage` for every frame in order. */
export async function readSse(body: ReadableStream<Uint8Array>, onMessage: (message: SseMessage) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { messages, rest } = parseSseFrames(buffer);
    buffer = rest;
    messages.forEach(onMessage);
  }
  buffer += decoder.decode();
  parseSseFrames(`${buffer}\n\n`).messages.forEach(onMessage);
}

/** Splits text into small pieces for `text` token events (graphemes, so emoji free CJK text never breaks mid character). */
export function textChunks(text: string, size = 6): string[] {
  const chars = [...text];
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += size) chunks.push(chars.slice(i, i + size).join(""));
  return chunks;
}
