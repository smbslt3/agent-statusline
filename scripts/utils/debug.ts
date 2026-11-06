/**
 * Debug utilities for agent-statusline
 *
 * Enable debug logging by setting DEBUG=agent-statusline or DEBUG=1
 */

const DEBUG =
  process.env.DEBUG === 'agent-statusline' ||
  process.env.DEBUG === '1' ||
  process.env.DEBUG === 'true';

/**
 * Log debug message if DEBUG is enabled
 */
export function debugLog(context: string, message: string, error?: unknown): void {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const prefix = `[agent-statusline:${context}]`;

  if (error) {
    console.error(`${timestamp} ${prefix} ${message}`, error);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}
