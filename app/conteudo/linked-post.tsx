"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { fmtDate, num, type Post } from "../integracoes/model";

export function LinkedPost({ id }: { id: string }) {
  const [entry, setEntry] = useState<{ post: Post; syncedAt: string } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/integracoes?publicacao=" + encodeURIComponent(id), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (r.ok) {
          const data = (await r.json()) as { entry: typeof entry };
          setEntry(data.entry);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id]);
  if (!entry) return null;
  const { post, syncedAt } = entry;
  return (
    <section className="hub-panel">
      <h3>Post orgânico vinculado</h3>
      <p>
        {num(post.likes)} curtidas · {num(post.comments)} comentários
      </p>
      <p>
        Instagram · {post.day} · Leitura {fmtDate(syncedAt)}
      </p>
      {post.url && (
        <a
          className="link-action"
          href={post.url}
          rel="noreferrer"
          target="_blank"
        >
          Abrir no Instagram <ArrowUpRight size={14} />
        </a>
      )}
    </section>
  );
}
