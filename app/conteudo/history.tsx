"use client";

import { useEffect, useState, type ReactNode } from "react";

export function HubHistory<Row extends { version: number }>({ brand, revision, kind, id, render, anchorPrefix }: {
  brand: string;
  revision: number;
  kind: "asset" | "guide" | "edition" | "result";
  id: string;
  render: (row: Row) => ReactNode;
  anchorPrefix?: string;
}) {
  const [page, setPage] = useState<number | null>(null);
  const [result, setResult] = useState<{ entries: Row[]; next: boolean; page: number }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ marca: brand, historico: kind, id, pagina: String(page || 1) });
    const hash = window.location.hash.slice(1);
    if (!page && anchorPrefix && hash.startsWith(anchorPrefix)) {
      const candidate = hash.slice(anchorPrefix.length);
      if (/^\d+$/.test(candidate)) params.set("versao", candidate);
    }
    async function load() {
      setResult(undefined);
      setError(false);
      try {
        const response = await fetch("/api/conteudo?" + params, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        setResult(await response.json());
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    queueMicrotask(() => { if (!controller.signal.aborted) void load(); });
    return () => controller.abort();
  }, [brand, id, kind, anchorPrefix, page, revision]);
  useEffect(() => {
    if (!page && result && anchorPrefix) {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith(anchorPrefix)) {
        const element = document.getElementById(hash);
        if (element instanceof HTMLDetailsElement) element.open = true;
        element?.scrollIntoView({ block: "start" });
      }
    }
  }, [anchorPrefix, page, result]);
  if (error) return <p role="alert">Não foi possível carregar o histórico.</p>;
  if (!result) return <p role="status">Carregando histórico…</p>;
  return <>
    {result.entries.map(render)}
    {(result.page > 1 || result.next) && (
      <div className="hub-actions" role="group" aria-label="Páginas do histórico">
        <button className="crm-secondary" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>Anterior</button>
        <span>Página {result.page}</span>
        <button className="crm-secondary" disabled={!result.next} onClick={() => setPage(result.page + 1)}>Próxima</button>
      </div>
    )}
  </>;
}
