export const AVATAR_BASES = ['wolf', 'fox', 'deer', 'bear', 'cat', 'owl', 'rabbit', 'panda'] as const

export type AvatarBase = (typeof AVATAR_BASES)[number]

export const AVATAR_LABELS: Record<AvatarBase, string> = {
  wolf: "Bo'ri",
  fox: 'Tulki',
  deer: 'Kiyik',
  bear: 'Ayiq',
  cat: 'Mushuk',
  owl: "Boyo'g'li",
  rabbit: 'Quyon',
  panda: 'Panda',
}
