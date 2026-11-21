"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowRight, ChevronDown, GripVertical, Inbox } from "lucide-react";
import { businessDay, dateLabel, money, stageDays, stages, today, type Deal, type DealStage, type State } from "./model";
import { dealName, memberName, queueGroup } from "./views";

const priorities = ["Vencidos", "Hoje", "Sem próximo passo", "Agendados"];
const dragType = "application/x-eba-opportunity";

type Actions = {
  state: State;
  open: (deal: Deal) => void;
  schedule: (deal: Deal) => void;
  move: (deal: Deal, stage: DealStage) => Promise<boolean>;
};

function JourneyCard({ deal, state, day, busy, open, schedule, move, drag, endDrag }: Actions & {
  deal: Deal;
  day: string;
  busy: boolean;
  drag: (event: DragEvent, deal: Deal) => void;
  endDrag: () => void;
}) {
  const [target, setTarget] = useState("");
  const name = dealName(state, deal);
  const age = stageDays(deal.stageSince, day);
  const priority = queueGroup(deal, day);
  return <article className="journey-card" aria-busy={busy || undefined}>
    <header>
      <h4><button className="deal-link" id={"journey-deal-" + deal.id} onClick={() => open(deal)}>{name}</button></h4>
      <span className="journey-grip" title="Arraste para mover" aria-hidden="true" draggable={!busy}
        onDragStart={(event) => drag(event, deal)} onDragEnd={endDrag}><GripVertical size={17} /></span>
    </header>
    <p className="journey-meta">{memberName(state, deal.owner)} <span>·</span> {age === null ? "Tempo na etapa indisponível" : age + (age === 1 ? " dia na etapa" : " dias na etapa")}</p>
    <div className="journey-next">
      <b className={priority === "Vencidos" || priority === "Sem próximo passo" ? "funnel-warning" : ""}>{deal.next || "Sem próximo passo"}</b>
      <small>{deal.due ? <time dateTime={deal.due}>{dateLabel(deal.due)}</time> : "Sem data combinada"}
        {priority === "Vencidos" ? " · Vencido" : priority === "Hoje" ? " · Hoje" : ""}</small>
    </div>
    {(deal.monthly !== null || deal.once !== null) && <dl className="journey-money">
      {deal.monthly !== null && <div><dt>Mensal</dt><dd>{money(deal.monthly)}</dd></div>}
      {deal.once !== null && <div><dt>Pontual</dt><dd>{money(deal.once)}</dd></div>}
    </dl>}
    <button className="operation-action journey-schedule" onClick={() => schedule(deal)}>
      {deal.next && deal.due ? "Reagendar retorno" : "Definir retorno"} <ArrowRight size={14} />
    </button>
    <form className="journey-move" onSubmit={(event) => {
      event.preventDefault();
      const stage = stages.find((value) => value === target);
      if (stage && stage !== deal.stage) void move(deal, stage);
    }}>
      <select value={target} onChange={(event) => setTarget(event.target.value)} aria-label={"Mover para, " + name} disabled={busy}>
        <option value="">Mover para…</option>
        {stages.filter((stage) => stage !== deal.stage).map((stage) => <option key={stage}>{stage}</option>)}
      </select>
      <button type="submit" className="crm-secondary" disabled={busy || !target} aria-label={"Mover " + name}>
        {busy ? "Salvando…" : "Mover"}
      </button>
    </form>
  </article>;
}

export function JourneyBoard({ state, list, open, schedule, move, moving }: Actions & { list: Deal[]; moving: ReadonlySet<string> }) {
  const [expanded, setExpanded] = useState<Partial<Record<DealStage, boolean>>>({});
  const [dragged, setDragged] = useState<Deal | null>(null);
  const [over, setOver] = useState<DealStage | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ id: string; stage: DealStage } | null>(null);
  const lastFocus = useRef<typeof focusTarget>(null);
  const day = today();
  const sorted = [...list].sort((a, b) =>
    priorities.indexOf(queueGroup(a, day)) - priorities.indexOf(queueGroup(b, day)) ||
    a.due.localeCompare(b.due) || dealName(state, a).localeCompare(dealName(state, b), "pt-BR") ||
    a.id.localeCompare(b.id));
  const columns = stages.map((stage) => ({ stage, cards: sorted.filter((deal) => deal.stage === stage) }));
  const firstFilled = columns.find(({ cards }) => cards.length)?.stage ?? stages[0];

  useEffect(() => {
    if (!focusTarget || focusTarget === lastFocus.current || moving.has(focusTarget.id)) return;
    if (list.find((deal) => deal.id === focusTarget.id)?.stage === focusTarget.stage) {
      lastFocus.current = focusTarget;
      document.getElementById("journey-deal-" + focusTarget.id)?.focus();
    }
  }, [focusTarget, moving, list]);

  function endDrag() {
    setDragged(null);
    setOver(null);
  }
  async function transfer(deal: Deal, stage: DealStage, keyboardOrTouch: boolean) {
    const moved = await move(deal, stage);
    if (moved) {
      setExpanded((previous) => ({ ...previous, [stage]: true }));
      if (keyboardOrTouch) setFocusTarget({ id: deal.id, stage });
    }
    return moved;
  }

  return <>
    {!list.length && <p className="journey-empty" role="status">Nenhuma oportunidade em aberto corresponde à seleção.</p>}
    <div className="journey-board" role="region" aria-label="Quadro de oportunidades" tabIndex={0}>
      {columns.map(({ stage, cards }) => {
        const shown = expanded[stage] ?? stage === firstFilled;
        return <section className="journey-lane" key={stage} aria-label={stage} data-open={shown}
          data-drop-target={over === stage || undefined}
          onDragOver={(event) => {
            if (!dragged || moving.has(dragged.id) || dragged.stage === stage || !event.dataTransfer.types.includes(dragType)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOver(stage);
          }}
          onDragLeave={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
              setOver((active) => active === stage ? null : active);
            }
          }}
          onDrop={(event) => {
            if (!dragged || dragged.stage === stage || event.dataTransfer.getData(dragType) !== dragged.id) return;
            event.preventDefault();
            endDrag();
            void transfer(dragged, stage, false);
          }}>
          <h3 className="journey-stage-desktop">{stage} <span>{cards.length}</span></h3>
          <h3 className="journey-stage-mobile"><button type="button" aria-expanded={shown} aria-controls={"journey-stage-" + stage}
            onClick={() => setExpanded((previous) => ({ ...previous, [stage]: !shown }))}>
            {stage} <span>{cards.length}</span><ChevronDown size={17} aria-hidden="true" />
          </button></h3>
          <div id={"journey-stage-" + stage} className="journey-cards">
            {!cards.length && <p className="journey-lane-empty">Nenhuma oportunidade</p>}
            {cards.map((deal) => <JourneyCard key={deal.id} state={state} deal={deal} day={day} busy={moving.has(deal.id)}
              open={open} schedule={schedule} move={(item, target) => transfer(item, target, true)} endDrag={endDrag}
              drag={(event, item) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(dragType, item.id);
                setDragged(item);
              }} />)}
          </div>
        </section>;
      })}
    </div>
  </>;
}

export function CompletedSales({ state, list, open }: Pick<Actions, "state" | "open"> & { list: Deal[] }) {
  const soldAt = new Map(state.activities.filter((activity) => activity.kind === "Venda ganha")
    .map((activity) => [activity.deal, activity.at]));
  const sales = list.map((deal) => ({ deal, date: soldAt.get(deal.id) || deal.updated }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.deal.id.localeCompare(b.deal.id));
  if (!sales.length) return <div className="crm-empty">
    <Inbox size={28} /><h3>Nenhuma venda concluída nesta seleção</h3>
    <p>As vendas confirmadas no CRM aparecem aqui.</p>
  </div>;
  return <table className="operation-queue journey-sales">
    <thead><tr><th scope="col">Empresa</th><th scope="col">Data da venda</th><th scope="col">Valores contratados</th><th scope="col">Ações</th></tr></thead>
    <tbody>{sales.map(({ deal, date }) => {
      const company = deal.company;
      return <tr key={deal.id}>
        <th scope="row">{dealName(state, deal)}</th>
        <td><span className="journey-sales-label">Data da venda</span><time dateTime={date}>{dateLabel(businessDay(new Date(date)))}</time></td>
        <td><span className="journey-sales-label">Valores contratados</span>
          <div className="journey-sale-values"><span>Mensal {money(deal.monthly)}</span><span>Pontual {money(deal.once)}</span></div>
        </td>
        <td><div className="journey-sale-actions">
          <button className="crm-secondary" onClick={() => open(deal)}>Ver venda</button>
          {company && <a className="operation-action" href={"/carteira?" + new URLSearchParams({ vista: "contas", conta: company })}>
            Abrir ficha do cliente <ArrowRight size={15} />
          </a>}
        </div></td>
      </tr>;
    })}</tbody>
  </table>;
}
