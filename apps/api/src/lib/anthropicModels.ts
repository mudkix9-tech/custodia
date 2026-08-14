/**
 * One place to name the Claude models this product calls.
 *
 * Every call site was pinned to `claude-3-5-sonnet-20240620`, which Anthropic
 * retired on 28 October 2025 — so since then every AI request in the product has
 * returned 404 and fallen through to whatever catch block was behind it. The
 * Copilot's read "This is a mock response because the Anthropic API failed or is
 * not configured", which reads like a local-dev message rather than the outage
 * it actually was.
 *
 * `claude-sonnet-5` is the documented drop-in replacement for that retired id,
 * and keeps the Sonnet tier the original author chose. Upgrading to
 * `claude-opus-5` is a one-line change here if the compliance answers warrant it.
 *
 * Pinning through a constant is the point: the next retirement is one edit, not
 * nine.
 */
export const COPILOT_MODEL = 'claude-sonnet-5';

/** Background jobs: same model, named separately so the two can diverge on cost. */
export const WORKER_MODEL = 'claude-sonnet-5';
