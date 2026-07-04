export type TraceStepType = 'model_output' | 'tool_call' | 'tool_response';

export interface TraceStep {
  index: number;
  agent: string;
  type: TraceStepType;
  content: string;
  reasoning?: string;
  toolName?: string;
  timestamp?: number;
  invocationId?: string;
  iteration?: number;
}

export interface CausalLink {
  why: string;
  because: string;
  link_validity: number;
  reasoning?: string;
}

export interface TrizScores {
  benefit: number;
  cost: number;
  harm: number;
  contradiction_resolution: number;
}

export interface Feasibility {
  buildable_48h: boolean;
  deployable: boolean;
}

export type CandidateSource = 'triz' | 'fiveY';

export interface CandidateRecord {
  id: string;
  title: string;
  summary: string;
  source: CandidateSource;
  causal_chain: CausalLink[];
  intervention_index: number;
  rcd: number;
  ccv: number;
  triz: TrizScores;
  downstream_symptoms_total: number;
  downstream_symptoms_resolved: number;
  feasibility: Feasibility;
  contradiction_sentence: string;
  principles_used?: string[];
  reasoning?: string;
}

export interface ScoredCandidate {
  record: CandidateRecord;
  x: number;
  y: number;
  dc: number;
  ccvComputed: number;
  feasible: boolean;
  onFrontier: boolean;
  passesGates: boolean;
}

export interface EvaluationResult {
  gateX: number;
  gateY: number;
  candidates: ScoredCandidate[];
  frontierIds: string[];
  gatedIds: string[];
  winnerId: string | null;
  verdict: string;
}

export interface ConformanceCheck {
  id: string;
  agent: string;
  passed: boolean;
  details: string;
}

export interface AgentTrace {
  steps: TraceStep[];
  causalChain: CausalLink[] | null;
  candidates: ScoredCandidate[];
  topTrizCandidates: ScoredCandidate[];
  topFiveYCandidates: ScoredCandidate[];
  evaluation: EvaluationResult | null;
  checks: ConformanceCheck[];
}
