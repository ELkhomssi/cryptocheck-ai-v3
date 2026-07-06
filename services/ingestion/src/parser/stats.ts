let llmHits = 0

export function markLlm(): void {
  llmHits += 1
}

export function getParserStats(): { llmHits: number } {
  return { llmHits }
}
