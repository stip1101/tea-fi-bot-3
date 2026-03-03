const TWITTER_HOSTS = ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'];

export function isTwitterUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return TWITTER_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function extractTweetId(url: string): string | null {
  if (!isTwitterUrl(url)) return null;

  try {
    const parsed = new URL(url);
    // Twitter URLs: /user/status/1234567890
    const match = parsed.pathname.match(/\/status\/(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
