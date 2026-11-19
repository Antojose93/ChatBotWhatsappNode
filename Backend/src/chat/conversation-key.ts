/**
 * Stable storage key shared by the legacy JSON files and SQLite.
 * WhatsApp JIDs contain characters that were previously replaced in filenames.
 */
export function conversationKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
