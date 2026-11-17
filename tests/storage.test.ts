import { describe, expect, it, beforeEach, vi } from 'vitest';
import { storage } from '../src/lib/storage';

// Mock localStorage for node environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
vi.stubGlobal('localStorage', mockLocalStorage);

describe('storage wrapper', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('gets and sets JSON values', () => {
    const val = { a: 1, b: 'test' };
    storage.set('key', val);
    expect(storage.get('key')).toEqual(val);
  });

  it('returns null for missing keys', () => {
    expect(storage.get('missing')).toBeNull();
  });

  it('handles invalid JSON gracefully', () => {
    mockLocalStorage.setItem('bad', '{invalid}');
    expect(storage.get('bad')).toBeNull();
  });

  it('removes keys', () => {
    storage.set('a', 1);
    storage.remove('a');
    expect(storage.get('a')).toBeNull();
  });
});
