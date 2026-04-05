export const OPTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gray:   { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  red:    { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  orange: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  green:  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  teal:   { bg: '#ccfbf1', text: '#115e59', border: '#5eead4' },
  blue:   { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
  pink:   { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
}

export const COLOR_KEYS = Object.keys(OPTION_COLORS)

export function optionStyle(colorKey?: string) {
  const c = OPTION_COLORS[colorKey ?? 'gray'] ?? OPTION_COLORS.gray
  return { backgroundColor: c.bg, color: c.text, borderColor: c.border }
}
