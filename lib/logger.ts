import { randomUUID } from 'crypto';

const LOG_LEVEL = (process.env.LOG_LEVEL || 'debug').toLowerCase();
const ENABLED_LEVELS = ['debug', 'info', 'warn', 'error'];
const isEnabled = (level: string) => ENABLED_LEVELS.indexOf(level) >= ENABLED_LEVELS.indexOf(LOG_LEVEL);

let currentRequestId: string | null = null;

export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

export function setRequestId(id: string | null) {
  currentRequestId = id;
}

export function getRequestId(): string {
  if (!currentRequestId) {
    currentRequestId = generateRequestId();
  }
  return currentRequestId;
}

interface LogOptions {
  component: string;
  step: string;
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  explanation?: string;
  data?: any;
  requestId?: string;
  durationMs?: number;
}

export function log(opts: LogOptions) {
  const level = opts.level || 'DEBUG';
  if (!isEnabled(level.toLowerCase())) return;

  const rid = opts.requestId || getRequestId();
  const ts = new Date().toISOString();
  const dur = opts.durationMs !== undefined ? ` | ${opts.durationMs}ms` : '';

  const header = `[${level}] [Request: ${rid}] [${ts}]`;
  const compStep = `Component: ${opts.component}\nStep: ${opts.step}${dur}`;

  let msg = `${header}\n${compStep}\n`;
  if (opts.explanation) {
    msg += `\nExplanation:\n${opts.explanation}\n`;
  }
  if (opts.data !== undefined) {
    msg += `\nData:\n${JSON.stringify(opts.data, null, 2)}\n`;
  }

  if (level === 'ERROR') {
    console.error(msg);
  } else if (level === 'WARN') {
    console.warn(msg);
  } else {
    console.log(msg);
  }
}

export function logLifecycle(type: 'START' | 'COMPLETE', summary?: any, requestId?: string) {
  const rid = requestId || getRequestId();
  const ts = new Date().toISOString();
  const sep = '='.repeat(50);
  if (type === 'START') {
    console.log(`\n${sep}\nNEW REQUEST\n${sep}\nRequest ID: ${rid}\nTimestamp: ${ts}\n`);
  } else {
    console.log(`\n${sep}\nREQUEST COMPLETE\n${sep}\nRequest ID: ${rid}\nTimestamp: ${ts}\n`);
    if (summary) {
      console.log('Summary:\n' + JSON.stringify(summary, null, 2) + '\n');
    }
  }
}

export function logPerformance(steps: Record<string, number>, totalMs?: number, requestId?: string) {
  const rid = requestId || getRequestId();
  const lines = Object.entries(steps).map(([k, v]) => `${k}: ${v}ms`).join('\n');
  const total = totalMs !== undefined ? `\nTotal Pipeline: ${totalMs}ms` : '';
  log({
    component: 'Performance',
    step: 'Pipeline Timings',
    level: 'INFO',
    explanation: 'Measured durations for each major step.',
    data: { ...steps, totalMs },
    requestId: rid,
  });
  console.log(`\nPerformance Breakdown:\n${lines}${total}\n`);
}

export function logError(component: string, operation: string, error: any, inputSummary?: any, recovery?: string, requestId?: string) {
  const rid = requestId || getRequestId();
  log({
    component,
    step: operation,
    level: 'ERROR',
    explanation: `Error during ${operation}. ${recovery ? 'Recovery: ' + recovery : ''}`,
    data: {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      inputSummary,
    },
    requestId: rid,
  });
}
