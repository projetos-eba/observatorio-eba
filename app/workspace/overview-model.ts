export const returnGoal = 8;

export type Commitment = {
  id: string;
  title: string;
  summary: string;
  date: string;
  kind: "return" | "handoff" | "decision" | "piece";
  href: string;
  review?: boolean;
};

export type Overview = {
  name: string;
  clients: number;
  monthly: number | null;
  returns: number;
  week: string;
  end: string;
  today: string;
  commitments: Commitment[];
  priorities: Commitment[];
};

export const commitmentAction: Record<Commitment["kind"], string> = {
  return: "Registrar retorno",
  handoff: "Abrir oportunidade",
  decision: "Abrir decisão",
  piece: "Ver peça",
};
