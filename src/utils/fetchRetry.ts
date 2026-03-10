export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 4,
  delay = 1500
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 && i < retries) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
        continue;
      }
      return res;
    } catch {
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
        continue;
      }
      throw new Error(`Failed after ${retries} retries: ${url}`);
    }
  }
  return fetch(url, options);
}
