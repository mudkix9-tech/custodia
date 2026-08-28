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
import { FinishReason, ThinkingLevel, type Content } from '@google/genai';
import { genai } from './genai.js';

/**
 * Two tiers, split by what the call actually asks the model to do rather than
 * by whether a human is waiting.
 *
 * `COPILOT_MODEL` and `WORKER_MODEL` were the same string, so every call site
 * paid frontier rates — including the ones emitting fifty tokens of
 * `{"isMaterial": true, ...}`. Output is billed at 6x here and **thinking is
 * billed as output**, so a classification that thinks for 1,500 tokens to
 * produce 50 costs thirty times its own answer. That is where the money went.
 */

/** Open-ended judgement a customer reads: the Copilot, an Art. 30 draft, a published notice. */
export const REASONING_MODEL = 'gemini-3.5-flash';

/**
 * Extraction, classification and parsing against an explicit rubric. Six times
 * cheaper on both sides ($0.25/$1.50 against $1.50/$9.00 per million), and the
 * tasks routed here are pattern-matching, not reasoning — `materialChange` is
 * rules-first and can only corroborate a verdict the rules already reached, so
 * it was never the model's judgement that decided anything.
 */
export const EXTRACTION_MODEL = 'gemini-3.1-flash-lite';

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
  /** Ask for a bare JSON document rather than prose that contains one. */
  json?: boolean;
}

export interface CompleteResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * Reasoning tokens. These come out of `maxTokens`, which is the trap when
   * porting from Anthropic: `max_tokens` there caps the *answer*, while
   * `maxOutputTokens` here caps thinking plus answer together. A budget that
   * was generous for one is not for the other.
   */
  thoughtsTokens: number;
  /** The budget ran out before the model stopped. The text is a fragment. */
  truncated: boolean;
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
    // Constrained decoding. The model emits a bare JSON document — no ```json
    // fences to strip, no preamble to slice past — which is both more reliable
    // and cheaper, because prose the caller was going to throw away was still
    // being paid for out of the same budget as the JSON.
    ...(input.json ? { responseMimeType: 'application/json' } : {}),
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

  const result: CompleteResult = {
    text: response.text ?? '',
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    thoughtsTokens: response.usageMetadata?.thoughtsTokenCount ?? 0,
    truncated: response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS,
  };

  logUsage(input, result);
  return result;
}

/**
 * Per-call cost, on one line, because the quota counts calls and the bill
 * counts tokens — and nobody could see the gap. `trackAiUsage(orgId, 1)` charges
 * a customer the same for "hi" as for a 200-page DPA.
 *
 * Estimated, not billed: these are list prices in USD per million tokens, and
 * the point is the shape of the spend, not an invoice. Thinking is folded into
 * output because that is how it is charged.
 */
const PRICES: Readonly<Record<string, { input: number; output: number }>> = {
  'gemini-3.5-flash': { input: 1.5, output: 9.0 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
};

function logUsage(input: CompleteInput, result: CompleteResult): void {
  const price = PRICES[input.model];
  const cost = price
    ? (result.inputTokens * price.input + result.outputTokens * price.output) / 1_000_000
    : null;

  console.log(
    JSON.stringify({
      tag: 'llm.usage',
      model: input.model,
      thinking: input.thinking ?? 'default',
      json: Boolean(input.json),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      thoughtsTokens: result.thoughtsTokens,
      maxTokens: input.maxTokens,
      truncated: result.truncated,
      ...(cost !== null ? { estUsd: Number(cost.toFixed(5)) } : {}),
    }),
  );
}

/**
 * A completion that must be JSON, parsed.
 *
 * Every call site used to do
 * `JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim())` and
 * report whatever `JSON.parse` threw. When the real cause was a truncated
 * response that surfaced as `Unterminated string in JSON at position 1739`,
 * which reads like the model produced nonsense — so the operator looks at the
 * prompt, and the actual fix is the token budget.
 *
 * Truncation is now its own error, named as such, because the two have nothing
 * in common: one is fixed by raising `maxTokens`, the other by changing what
 * you asked for.
 */
export async function completeJson<T = unknown>(input: CompleteInput): Promise<T> {
  const result = await complete({ ...input, json: true });

  if (result.truncated) {
    throw new Error(
      `The model hit its ${input.maxTokens}-token output budget before finishing ` +
        `(${result.thoughtsTokens} of it spent on reasoning) and the JSON is a ` +
        'fragment. Raise maxTokens for this call.',
    );
  }

  const text = result.text.trim();
  if (!text) throw new Error('The model returned an empty response.');

  try {
    return JSON.parse(text) as T;
  } catch {
    // responseMimeType makes fences unlikely rather than impossible, and a
    // brace-slice costs nothing next to a failed compliance draft.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error(`The model did not return JSON: ${text.slice(0, 200)}`);
  }
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
