/**
 * One place to name the models this product calls, and one adapter to call them.
 *
 * Replaces `anthropicModels.ts`. The history that file recorded is the reason
 * this one exists: every call site was pinned to `claude-3-5-sonnet-20240620`,
 * which was retired on 28 October 2025, so every AI request in the product
 * returned 404 for months and fell through to a catch block that printed "This
 * is a mock response because the Anthropic API failed or is not configured".
 * A model id is a thing that expires, and an expiring value belongs behind one
 * constant rather than scattered across nine files.
 *
 * The adapter is here for the same reason `genai.ts` holds one client rather
 * than the four each module used to build: eleven call sites had eleven copies
 * of `msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n')`,
 * and a provider migration had to touch every one of them. Swapping provider
 * again should be this file, not another sweep.
 */
import { ThinkingLevel, type Content } from '@google/genai';
import { genai } from './genai.js';

/** Interactive paths — the Copilot and the assessment helpers. */
export const COPILOT_MODEL = 'gemini-3.5-flash';

/** Background jobs: same model, named separately so the two can diverge on cost. */
export const WORKER_MODEL = 'gemini-3.5-flash';

/**
 * The message shape the call sites already speak, kept deliberately in
 * Anthropic's vocabulary (`assistant`, not Gemini's `model`) so the migration
 * did not have to rewrite every history-building helper. `toContents` does the
 * translation in one place.
 */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteInput {
  model: string;
  /** Hoisted out of the turns, as `system` was — Gemini calls it an instruction. */
  system?: string;
  /** Either a full history, or a single prompt for the one-shot callers. */
  messages?: LlmMessage[];
  prompt?: string;
  maxTokens: number;
  /**
   * Only set where the old call site set it. `low` keeps a chat answer from
   * stalling behind a long think; unset lets the model decide, which is what
   * every non-streaming site was already doing.
   */
  thinking?: 'minimal' | 'low';
}

export interface CompleteResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Turns are `{ role: 'user' | 'model', parts: [{ text }] }` here. The role
 * rename is the only lossy part of the translation and it is total: Gemini has
 * no third role, and a `system` turn would be silently accepted and ignored,
 * which is why the system prompt goes through `systemInstruction` instead.
 */
function toContents(input: CompleteInput): Content[] {
  const turns: LlmMessage[] = input.messages?.length
    ? input.messages
    : [{ role: 'user', content: input.prompt ?? '' }];

  return turns.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));
}

function toConfig(input: CompleteInput) {
  return {
    ...(input.system ? { systemInstruction: input.system } : {}),
    maxOutputTokens: input.maxTokens,
    ...(input.thinking
      ? {
          thinkingConfig: {
            thinkingLevel:
              input.thinking === 'minimal' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
          },
        }
      : {}),
  };
}

/**
 * One-shot completion. Returns the text and the token counts together because
 * `impactAssessmentWorker` bills on them and used to read
 * `msg.usage.input_tokens` directly off the provider's response — the sort of
 * detail that makes a provider swap a billing bug.
 *
 * `response.text` concatenates the text parts of the first candidate, so it is
 * the direct equivalent of the filter/map/join every call site was doing. It is
 * `string | undefined`: undefined means the model returned no text part at all
 * (a safety block, or a stop before the first token), which the callers'
 * existing "empty response" branches already handle.
 */
export async function complete(input: CompleteInput): Promise<CompleteResult> {
  const response = await genai.models.generateContent({
    model: input.model,
    contents: toContents(input),
    config: toConfig(input),
  });

  return {
    text: response.text ?? '',
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Streaming completion, yielding text deltas.
 *
 * The Anthropic version filtered a typed event union down to
 * `content_block_delta` / `text_delta`. Here every chunk is a response object
 * whose `.text` is that chunk's contribution, so the filter is just dropping
 * the empty ones — a chunk carrying only a finish reason or usage metadata has
 * no text and must not be yielded as an empty string, or the caller's
 * accumulator gains nothing and the client renders a flicker.
 */
export async function* completeStream(input: CompleteInput): AsyncGenerator<string> {
  const stream = await genai.models.generateContentStream({
    model: input.model,
    contents: toContents(input),
    config: toConfig(input),
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
