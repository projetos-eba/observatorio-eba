"use client";

import { useEffect, useRef } from "react";

export default function Home() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    async function launch() {
      for (const file of ["seed", "icons", "dialogs", "radar"]) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/" + file + ".js";
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
    }
    launch().catch(() => {
      const view = document.getElementById("app");
      if (view) view.innerHTML = '<main class="boot" role="alert"><h1>Radar de performance</h1><p>O painel não carregou.</p><button onclick="location.reload()">Tentar novamente</button></main>';
    });
  }, []);
  return <div id="app"><main className="boot" aria-busy="true"><strong>EBA GROWTH</strong><p>Carregando o radar…</p></main></div>;
}
