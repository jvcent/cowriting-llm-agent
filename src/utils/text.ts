export function cleanText(text: string): string {
  // First remove text between asterisks, including the asterisks themselves
  const withoutAsterisks = text.replace(/\*[^*]*\*/g, "");
  // Then trim whitespace and newlines from both ends
  return withoutAsterisks.trim();
}
