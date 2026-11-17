import { describe, expect, it, vi } from 'vitest';

// Mock Firebase config
vi.mock('../src/config/firebase', () => ({
  db: {},
  auth: {},
  rtdb: {}
}));

import { getDMId } from '../src/features/chat/dmApi';

describe('getDMId', () => {
  it('is order-independent', () => {
    expect(getDMId('userA', 'userB')).toBe('userA_userB');
    expect(getDMId('userB', 'userA')).toBe('userA_userB');
  });

  it('works with alphanumeric ids', () => {
    expect(getDMId('u1', 'u2')).toBe('u1_u2');
  });
});
