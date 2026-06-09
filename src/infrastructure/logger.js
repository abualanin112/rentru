import pino from 'pino';
import { config } from './config.js';
import { als as asyncLocalStorage } from './als.js';

/**
 * Pino Logger Configuration
 * Aggressively redacts sensitive data (passwords, tokens, cookies).
 */
let logLevel = 'info';
if (config.env === 'test') {
  logLevel = 'silent';
} else if (config.env === 'development') {
  logLevel = 'debug';
}

// 1. تعريف الإعدادات الأساسية المشتركة في كائن
const pinoOptions = {
  level: logLevel,
  formatters: {
    level: (label) => ({ level: label }), // Map standard text levels (e.g., 'info') instead of numeric values
    log: (object) => {
      // Standardize timing fields to durationMs as per Phase 2.5
      if (object.responseTime !== undefined) {
        const { responseTime, ...rest } = object;
        return { ...rest, durationMs: responseTime };
      }
      return object;
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.passwordConfirmation',
      'body.token',
      'body.refreshToken',
      'user.password',
      '*.password', // Generic catch-all for deeply nested passwords
      'password',
    ],
    censor: '[REDACTED]',
  },
  // Ensure background tasks (without ALS) still have basic identifiers
  base: {
    env: config.env,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// 2. حقن pino-pretty فقط إذا كنا في بيئة التطوير
if (config.env === 'development') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname,env',
      messageFormat: '{msg}',
    },
  };
}

// 3. تمرير الإعدادات المجمعة لإنشاء النسخة الأساسية
export const baseLogger = pino(pinoOptions);

const getOrCreateChild = (key, bindings) => {
  const store = asyncLocalStorage.getStore();
  const parent = store?.logger || baseLogger;
  if (!store) return parent.child(bindings);

  if (!store._childLoggers) store._childLoggers = {};
  // eslint-disable-next-line security/detect-object-injection
  if (!store._childLoggers[key]) {
    // eslint-disable-next-line security/detect-object-injection
    store._childLoggers[key] = parent.child(bindings);
  }
  // eslint-disable-next-line security/detect-object-injection
  return store._childLoggers[key];
};

/**
 * Contextual Logger Proxy
 * Intercepts logging calls and checks if there is a child logger in the ALS context.
 * If true (i.e. within an HTTP request), it automatically injects `reqId` and `userId`.
 * If false (i.e. background job), it falls back to the global `baseLogger`.
 */
const logger = {
  info: (...args) => (asyncLocalStorage.getStore()?.logger || baseLogger).info(...args),
  error: (...args) => (asyncLocalStorage.getStore()?.logger || baseLogger).error(...args),
  warn: (...args) => (asyncLocalStorage.getStore()?.logger || baseLogger).warn(...args),
  debug: (...args) => (asyncLocalStorage.getStore()?.logger || baseLogger).debug(...args),
  fatal: (...args) => (asyncLocalStorage.getStore()?.logger || baseLogger).fatal(...args),
  trace: (...args) => (asyncLocalStorage.getStore()?.logger || baseLogger).trace(...args),
  child: (bindings) => {
    const key = JSON.stringify(bindings);
    return {
      info: (...args) => getOrCreateChild(key, bindings).info(...args),
      error: (...args) => getOrCreateChild(key, bindings).error(...args),
      warn: (...args) => getOrCreateChild(key, bindings).warn(...args),
      debug: (...args) => getOrCreateChild(key, bindings).debug(...args),
      fatal: (...args) => getOrCreateChild(key, bindings).fatal(...args),
      trace: (...args) => getOrCreateChild(key, bindings).trace(...args),
    };
  },
};

export { logger };
