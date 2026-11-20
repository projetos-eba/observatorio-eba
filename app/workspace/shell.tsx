"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen, ChartNoAxesCombined, FlaskConical, Layers, LayoutGrid, Menu,
  PanelLeft, Plug, Plus, Search, Target, UserRound,
} from "lucide-react";

const links = [
  { label: "Workspace", items: [
    { title: "Visão geral", href: "/", icon: LayoutGrid },
    { title: "CRM comercial", href: "/crm", icon: UserRound },
    { title: "Clientes e Método PICO", href: "/carteira", icon: Layers },
    { title: "Hub de Conteúdo", href: "/conteudo", icon: BookOpen },
  ] },
  { label: "Inteligência", items: [
    { title: "Radar de novidades", href: "/radar#radar", icon: Target },
    { title: "Comparativo", href: "/radar#compare", icon: ChartNoAxesCombined },
    { title: "Laboratório de testes", href: "/radar#tests", icon: FlaskConical },
    { title: "Banco de insights", href: "/radar#insights", icon: Layers },
  ] },
];

export function WorkspaceShell({ current, name, search, setSearch, create, title: pageTitle, children }: {
  current: "/" | "/crm" | "/carteira";
  title?: string;
  name?: string;
  search?: string;
  setSearch?: (value: string) => void;
  create?: () => void;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState("");
  const title = pageTitle || (current === "/" ? "Visão geral" : current === "/crm" ? "CRM comercial" : "Clientes e Método PICO");
  const initials = name?.split("@")[0].split(/[ ._-]+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  function submit(event: FormEvent) {
    if (!setSearch) return;
    event.preventDefault();
    document.getElementById("crm-results")?.focus();
  }
  return <div className="crm-space eba-operation">
    <a className="skip" href="#workspace-main">Ir ao conteúdo</a>
    <aside id="workspace-navigation" className={menu ? "crm-side menu-visible" : "crm-side"}>
      <Link href="/" className="brand-link" aria-label="EBA Growth, visão geral">
        <span className="brand"><span className="brand-eba">eba<span>.</span></span><i /><span className="brand-growth">GROWTH</span></span>
      </Link>
      <nav aria-label="Navegação principal">
        {links.map(({ label, items }) => <div className="workspace-nav-group" key={label}>
          <h2 className="eyebrow">{label}</h2>
          {items.map(({ title, href, icon: Icon }) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>
            <Icon size={19} aria-hidden="true" /><span>{title}</span>
          </Link>)}
        </div>)}
      </nav>
      <div className="workspace-nav-foot"><Link href="/integracoes"><Plug size={18} aria-hidden="true" /> Integrações</Link></div>
    </aside>
    <div className="crm-main">
      <header className="crm-bar workspace-bar">
        <div className="workspace-crumb">
          <button type="button" className="workspace-menu icon-action" aria-expanded={menu} aria-controls="workspace-navigation" aria-label={menu ? "Fechar navegação" : "Abrir navegação"} onClick={() => setMenu(!menu)}><Menu size={19} /></button>
          <PanelLeft className="workspace-panel-icon" size={17} aria-hidden="true" />
          {current === "/carteira" ? <Link className="workspace-crumb-parent" href="/carteira?vista=contas">Clientes</Link> : <span className="workspace-crumb-parent">EBA Growth</span>}<span aria-hidden="true">/</span><b>{title}</b>
        </div>
        <form action="/crm" className="crm-search workspace-search" onSubmit={submit}>
          <Search size={17} aria-hidden="true" />
          <input aria-label="Buscar empresa ou contato" name="busca" type="search" placeholder="Buscar empresa ou contato" value={search ?? term} onChange={(event) => (setSearch || setTerm)(event.target.value)} />
        </form>
        {current === "/" && (create ?
          <button type="button" className="crm-secondary workspace-create" onClick={create}><Plus size={17} />Criar</button> :
          <Link href="/crm?acao=nova" className="crm-secondary workspace-create"><Plus size={17} />Criar</Link>)}
        {initials && <span className="workspace-avatar" title={name} aria-label={name}>{initials}</span>}
      </header>
      <main className="crm-inner workspace-inner" id="workspace-main">{children}</main>
    </div>
  </div>;
}
