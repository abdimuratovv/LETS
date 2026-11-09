import type { ResourceType } from './service'

export const TYPE_LABEL: Record<ResourceType, string> = {
  link: 'Havola',
  file: 'Fayl',
  note: 'Konspekt',
}

export const TYPE_ICON: Record<ResourceType, string> = {
  link: '🔗',
  file: '📄',
  note: '📝',
}

/** 1024 asosida: "512 B", "1.5 KB", "12.3 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${trim(kb)} KB`
  return `${trim(kb / 1024)} MB`
}

function trim(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '')
}
