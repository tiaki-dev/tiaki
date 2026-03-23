/**
 * Minimal glob match for image patterns like "nginx:*", "*.example.com/*:*".
 * Only supports * (match any sequence except colon) and ** (match anything).
 */
export function globMatch(pattern: string, value: string): boolean {
  // Escape regex special chars except * which we convert
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.+')    // ** → match anything
    .replace(/\*/g, '[^:]*')   // * → match anything except colon
  return new RegExp(`^${regexStr}$`).test(value)
}
