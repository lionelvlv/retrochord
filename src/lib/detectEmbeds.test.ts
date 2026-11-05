import { describe, expect, it } from 'vitest';
import { detectEmbeds } from './mediaUpload';

const kinds = (text: string) => detectEmbeds(text).map(e => e.kind);

describe('detectEmbeds', () => {
  it('turns YouTube watch, short and youtu.be links into privacy-mode embeds', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(detectEmbeds(url)[0]).toMatchObject({
        kind: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      });
    }
  });

  it('builds Vimeo and Spotify player URLs', () => {
    expect(detectEmbeds('https://vimeo.com/76979871')[0].embedUrl).toBe('https://player.vimeo.com/video/76979871');
    expect(detectEmbeds('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')[0].embedUrl)
      .toContain('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
  });

  it('tells GitHub repos, PRs/issues and gists apart', () => {
    expect(kinds('https://github.com/lionelvlv/3d-chess')).toEqual(['github_repo']);
    expect(kinds('https://github.com/lionelvlv/3d-chess/pull/1')).toEqual(['github_pr']);
    expect(kinds('https://github.com/lionelvlv/3d-chess/issues/2')).toEqual(['github_pr']);
    expect(kinds('https://gist.github.com/someone/abc123')).toEqual(['github_gist']);
  });

  it('serves Imgur gifv as mp4 video', () => {
    expect(detectEmbeds('https://i.imgur.com/abc123.gifv')[0]).toMatchObject({
      kind: 'imgur_image', embedUrl: 'https://i.imgur.com/abc123.mp4', meta: { isVideo: 'true' },
    });
  });

  it('embeds direct image links, including ones with query strings', () => {
    expect(kinds('look https://example.com/cat.png?w=200')).toEqual(['image_url']);
  });

  it('ignores plain links and duplicates, and finds several links in one message', () => {
    expect(kinds('https://example.com/page')).toEqual([]);
    const yt = 'https://youtu.be/dQw4w9WgXcQ';
    expect(kinds(`${yt} and again ${yt} plus https://vimeo.com/1`)).toEqual(['youtube', 'vimeo']);
  });

  it('stops a URL at closing brackets and quotes', () => {
    expect(detectEmbeds('(see https://youtu.be/dQw4w9WgXcQ)')[0].originalUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  });
});
