/**
 * lib/ai/json-parser.ts
 * Standalone, fault-tolerant JSON extraction, repair, and schema validation utility for LLM outputs.
 * Handles markdown formatting, unclosed brackets/braces, unescaped strings, and truncated streams.
 */

import { z } from 'zod';

/**
 * Repairs truncated or malformed JSON strings produced by LLM token cutoffs.
 * Automatically balances unclosed quotes, curly braces, and square brackets.
 */
export function repairTruncatedJson(jsonStr: string): string {
  let str = jsonStr.trim();

  // 1. Check for unclosed string literal
  let openQuote = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
      openQuote = !openQuote;
    }
  }
  if (openQuote) {
    str += '"';
  }

  // 2. Remove trailing dangling punctuation (commas, colons)
  str = str.replace(/[,:]\s*$/, '');

  // 3. Balance unclosed opening brackets and braces
  const stack: string[] = [];
  let inStr = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inStr = !inStr;
    }
    if (!inStr) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') str += '}';
    else if (last === '[') str += ']';
  }

  return str;
}

/**
 * Extracts and cleans JSON from raw LLM text (handling markdown wrappers, leading/trailing conversational text).
 */
export function extractJsonString(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText.trim();

  // Strip markdown ```json ... ``` blocks
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (markdownMatch && markdownMatch[1]?.trim()) {
    cleaned = markdownMatch[1].trim();
  } else {
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  // Find outermost JSON object or array bounds
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  let endChar = '}';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    endChar = ']';
  }

  if (start !== -1) {
    const lastEnd = cleaned.lastIndexOf(endChar);
    if (lastEnd > start) {
      cleaned = cleaned.substring(start, lastEnd + 1);
    } else {
      cleaned = cleaned.substring(start);
    }
  }

  return cleaned;
}

/**
 * Parses raw LLM text into a typed JSON object with multi-stage fallback and truncation repair.
 */
export function parseLLMJson<T>(rawText: string, fallback?: T): T {
  if (!rawText || rawText.trim() === '') {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty text provided to parseLLMJson');
  }

  const cleaned = extractJsonString(rawText);

  // Attempt 1: Direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt 2: Repaired cleaned text
    try {
      const repaired = repairTruncatedJson(cleaned);
      return JSON.parse(repaired) as T;
    } catch {
      // Attempt 3: Repaired raw text
      try {
        const repairedRaw = repairTruncatedJson(rawText);
        return JSON.parse(repairedRaw) as T;
      } catch (err) {
        if (fallback !== undefined) {
          return fallback;
        }
        throw new Error(`Failed to parse LLM JSON: ${(err as Error).message}`);
      }
    }
  }
}

/**
 * Parses raw LLM text and validates it against a Zod schema.
 */
export function parseAndValidateLLMJson<T>(
  rawText: string,
  schema: z.ZodType<T>,
  fallback?: T
): { success: true; data: T } | { success: false; error: string; data?: T } {
  try {
    const rawParsed = parseLLMJson<unknown>(rawText);
    const result = schema.safeParse(rawParsed);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: result.error.message,
      data: fallback,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
      data: fallback,
    };
  }
}
