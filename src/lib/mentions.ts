// True when `content` @mentions `username` as a whole name: "@al" matches
// "hi @al!" but not "@alice". Usernames are [a-zA-Z0-9_] (see the
// autocomplete in MessageComposer), so any other character ends a mention.
export function mentionsUser(content: string | undefined | null, username: string | undefined | null): boolean {
  if (!content || !username) return false;
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`@${escaped}(?![a-zA-Z0-9_])`, 'i').test(content);
}
