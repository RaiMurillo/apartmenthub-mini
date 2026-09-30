import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Documents live in a private bucket, so the browser can't open them
 * directly. We create short-lived (5 minute) signed links on the server.
 * The storage RLS policies decide which paths the current user may sign.
 */
export async function withDocumentUrls<T extends { document_path: string | null }>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<(T & { documentUrl: string | null })[]> {
  const paths = rows.map((row) => row.document_path).filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();

  if (paths.length > 0) {
    const { data } = await supabase.storage.from('documents').createSignedUrls(paths, 300);
    data?.forEach((item) => {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
    });
  }

  return rows.map((row) => ({
    ...row,
    documentUrl: row.document_path ? (urlByPath.get(row.document_path) ?? null) : null,
  }));
}
