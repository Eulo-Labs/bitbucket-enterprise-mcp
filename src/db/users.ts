import { db } from './service';
import { getAtlassianUser, getAtlassianUserEmail } from '../oauth/atlassian';
import type { UserRow } from '../audit/types';

export async function getOrFetchUser(
  accountId: string,
  accessToken: string,
): Promise<UserRow | null> {
  try {
    const cached = await db.getUserById(accountId);
    if (cached) return cached;
    const [user, email] = await Promise.all([
      getAtlassianUser(accessToken),
      getAtlassianUserEmail(accessToken),
    ]);
    await db.upsertUser({
      account_id: user.account_id,
      display_name: user.display_name,
      email,
      avatar_url: user.avatar_url,
    });
    return {
      account_id: user.account_id,
      display_name: user.display_name,
      email,
      avatar_url: user.avatar_url,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[getOrFetchUser] Failed:', err);
    return null;
  }
}
