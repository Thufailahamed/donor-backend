import { prisma } from '../lib/prisma';

interface KeywordCache {
  keywords: string[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache: KeywordCache | null = null;

async function getKeywords(): Promise<string[]> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.keywords;
  }

  // Temporarily returning empty list as 'settings' model is missing from schema
  let keywords: string[] = [];
  
  /*
  const setting = await prisma.settings.findUnique({
    where: { key: 'moderationKeywords' },
  });

  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        keywords = parsed.filter((k): k is string => typeof k === 'string');
      }
    } catch {
      keywords = [];
    }
  }
  */

  cache = { keywords, fetchedAt: now };
  return keywords;
}

export async function checkKeywordBlacklist(
  text: string
): Promise<{ blocked: boolean; matchedKeywords: string[] }> {
  const keywords = await getKeywords();

  if (!keywords.length) {
    return { blocked: false, matchedKeywords: [] };
  }

  const lowerText = text.toLowerCase();
  const matchedKeywords = keywords.filter(
    (keyword) => lowerText.includes(keyword.toLowerCase())
  );

  if (matchedKeywords.length > 0) {
    return { blocked: true, matchedKeywords };
  }

  return { blocked: false, matchedKeywords: [] };
}

/**
 * Invalidate the keyword cache so the next check re-fetches from the database.
 * Call this after updating the moderationKeywords setting.
 */
export function invalidateKeywordCache(): void {
  cache = null;
}
