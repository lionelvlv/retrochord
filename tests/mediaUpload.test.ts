import { describe, expect, it } from 'vitest';
import { validateFile, getAttachmentKind, MAX_FILE_SIZE_BYTES } from '../src/lib/mediaUpload';

describe('mediaUpload validation', () => {
  it('identifies attachment kind correctly', () => {
    expect(getAttachmentKind('image/png')).toBe('image');
    expect(getAttachmentKind('video/mp4')).toBe('video');
    expect(getAttachmentKind('audio/mp3')).toBe('audio');
    expect(getAttachmentKind('application/pdf')).toBe('file');
  });

  it('rejects files larger than 8MB', () => {
    const file = new File([''], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });
    expect(validateFile(file)).toContain('exceeds 8 MB');
  });

  it('rejects blocked extensions', () => {
    const file = new File([''], 'script.exe', { type: 'application/octet-stream' });
    expect(validateFile(file)).toContain('not allowed');
  });

  it('accepts valid files', () => {
    const file = new File([''], 'cat.png', { type: 'image/png' });
    expect(validateFile(file)).toBeNull();
  });
});
