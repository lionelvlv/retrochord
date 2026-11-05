import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../types/message';

// unreadStore keeps module-level state, so load a fresh copy for every test.
let store: typeof import('./unreadStore');
beforeEach(async () => {
  vi.resetModules();
  store = await import('./unreadStore');
});

const ME = 'u-me';
let seq = 0;
const msg = (over: Partial<Message>): Message => ({
  id: `m${++seq}`, senderId: 'u-other', content: 'hello', timestamp: 1000,
  deleted: false, reactions: [], ...over,
});

describe('updateUnread', () => {
  it('counts only messages newer than the last read time', () => {
    store.updateUnread('ch', [msg({ timestamp: 500 }), msg({ timestamp: 1500 }), msg({ timestamp: 2000 })], ME, 'al', 1000);
    expect(store.getUnread('ch').unread).toBe(2);
  });

  it('ignores my own and deleted messages', () => {
    store.updateUnread('ch', [msg({ senderId: ME }), msg({ deleted: true }), msg({})], ME, 'al', 0);
    expect(store.getUnread('ch').unread).toBe(1);
  });

  it('counts @mentions separately and remembers which messages they were', () => {
    const m = msg({ content: 'hey @al' });
    store.updateUnread('ch', [m, msg({})], ME, 'al', 0);
    const u = store.getUnread('ch');
    expect(u.unread).toBe(2);
    expect(u.mentions).toBe(1);
    expect([...u.mentionMessageIds]).toEqual([m.id]);
  });

  it('does not treat @alice as a mention of al', () => {
    store.updateUnread('ch', [msg({ content: '@alice look' })], ME, 'al', 0);
    expect(store.getUnread('ch').mentions).toBe(0);
  });

  it('in DMs only counts explicit mentions', () => {
    store.updateUnread('dm', [msg({}), msg({ content: '@al ping' })], ME, 'al', 0, true);
    expect(store.getUnread('dm')).toMatchObject({ unread: 1, mentions: 1 });
  });

  it('notifies subscribers only when the counts change', () => {
    const fn = vi.fn();
    store.subscribeUnread(fn);
    const msgs = [msg({})];
    store.updateUnread('ch', msgs, ME, 'al', 0);
    store.updateUnread('ch', msgs, ME, 'al', 0);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('markRead / markMentionSeen', () => {
  it('markRead clears the badge', () => {
    store.updateUnread('ch', [msg({ content: '@al' })], ME, 'al', 0);
    store.markRead('ch');
    expect(store.getUnread('ch')).toMatchObject({ unread: 0, mentions: 0 });
  });

  it('markMentionSeen decrements once per mention message', () => {
    const m = msg({ content: '@al' });
    store.updateUnread('ch', [m, msg({})], ME, 'al', 0);
    store.markMentionSeen('ch', m.id);
    store.markMentionSeen('ch', m.id); // second call is a no-op
    expect(store.getUnread('ch')).toMatchObject({ unread: 1, mentions: 0 });
  });

  it('getTotalMentions sums across channels', () => {
    store.updateUnread('a', [msg({ content: '@al' })], ME, 'al', 0);
    store.updateUnread('b', [msg({ content: '@al' }), msg({ content: '@al again' })], ME, 'al', 0);
    expect(store.getTotalMentions()).toBe(3);
  });
});
