export function buildStoragePath(topicId: string, ext: string): string {
  return `${topicId}/${crypto.randomUUID()}.${ext}`
}
