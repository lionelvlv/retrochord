import { describe, expect, it } from 'vitest';
import { mentionsUser } from './mentions';

describe('mentionsUser', () => {
  it('matches an exact @mention anywhere in the message', () => {
    expect(mentionsUser('hey @al', 'al')).toBe(true);
    expect(mentionsUser('@al what do you think?', 'al')).toBe(true);
  });

  it('ends the mention at punctuation', () => {
    expect(mentionsUser('thanks @al!', 'al')).toBe(true);
    expect(mentionsUser('(@al)', 'al')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(mentionsUser('ping @AL', 'al')).toBe(true);
    expect(mentionsUser('ping @al', 'Al')).toBe(true);
  });

  it('does not match a longer username that starts with the same letters', () => {
    expect(mentionsUser('@alice can you check this', 'al')).toBe(false);
    expect(mentionsUser('@al_2 hi', 'al')).toBe(false);
  });

  it('needs the @', () => {
    expect(mentionsUser('al said hi', 'al')).toBe(false);
  });

  it('treats regex characters in names literally', () => {
    expect(mentionsUser('@a.b hi', 'a.b')).toBe(true);
    expect(mentionsUser('@axb hi', 'a.b')).toBe(false);
  });

  it('handles missing content or username', () => {
    expect(mentionsUser(undefined, 'al')).toBe(false);
    expect(mentionsUser('@al', '')).toBe(false);
  });
});
