import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const BUCKET = "transaction-images";
const MAX_PER_RECORD = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

type Kind = "trade" | "expense";

/**
 * Hook for uploading & deleting images attached to a trade or expense row.
 * Files are stored at: {user_id}/{kind}/{record_id}/{timestamp}-{random}.{ext}
 */
export function useImageUpload(kind: Kind) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const signedUrl = useCallback(async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  }, []);

  const upload = useCallback(async (recordId: string, files: File[], existing: string[] = []): Promise<string[] | null> => {
    if (!user) { toast.error("Not signed in"); return null; }
    if (existing.length + files.length > MAX_PER_RECORD) {
      toast.error(`Max ${MAX_PER_RECORD} images per record`);
      return null;
    }
    setBusy(true);
    const newPaths: string[] = [];
    try {
      for (const f of files) {
        if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} > 5MB`); continue; }
        const ext = f.name.split(".").pop() || "jpg";
        const key = `${user.id}/${kind}/${recordId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(key, f, { upsert: false, contentType: f.type });
        if (error) { toast.error(error.message); continue; }
        newPaths.push(key);
      }
      if (!newPaths.length) return null;
      const tableName = kind === "trade" ? "trades" : "expenses";
      const merged = [...existing, ...newPaths];
      const { error: updErr } = await supabase
        .from(tableName)
        .update({ image_urls: merged } as any)
        .eq("id", recordId);
      if (updErr) { toast.error(updErr.message); return null; }
      toast.success(`Uploaded ${newPaths.length} image${newPaths.length > 1 ? "s" : ""}`);
      return merged;
    } finally {
      setBusy(false);
    }
  }, [kind, user]);

  const remove = useCallback(async (recordId: string, path: string, existing: string[]): Promise<string[] | null> => {
    setBusy(true);
    try {
      await supabase.storage.from(BUCKET).remove([path]);
      const next = existing.filter((p) => p !== path);
      const tableName = kind === "trade" ? "trades" : "expenses";
      const { error } = await supabase
        .from(tableName)
        .update({ image_urls: next } as any)
        .eq("id", recordId);
      if (error) { toast.error(error.message); return null; }
      return next;
    } finally {
      setBusy(false);
    }
  }, [kind]);

  return { upload, remove, signedUrl, busy, MAX_PER_RECORD };
}
