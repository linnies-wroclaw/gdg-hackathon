import {
  LlmAgent,
  MCPToolset,
  RoutedAgent,
  type StreamableHTTPConnectionParams,
} from '@google/adk';
import { z } from 'zod';

const mcpUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';

const connectionParams: StreamableHTTPConnectionParams = {
  type: 'StreamableHTTPConnectionParams',
  url: mcpUrl,
};

const trizToolset = new MCPToolset(connectionParams);

// ==========================================
// ZOD SCHEMAS FOR STRUCTURED OUTPUTS
// ==========================================

const GoalExtractionSchema = z.object({
  status: z.literal('COMPLETED'),
  parsedGoal: z.string(),
});

const ContradictionSolverSchema = z.object({
  status: z.literal('COMPLETED'),
  identifiedConflicts: z.array(z.string()),
  keyContradiction: z.object({
    improvingParameter: z.string(),
    worseningParameter: z.string(),
  }),
  recommendedMethod: z.literal('TRIZ'),
});

const RagCitationSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  urlOrDoi: z.string(),
  relevantExcerpt: z.string(),
});

const CandidateGenerationSchema = z.object({
  candidateId: z.string(),
  category: z.enum(['SHORT_TERM_EASY', 'LONG_TERM_HIGH_IMPACT']),
  title: z.string(),
  shortDescription: z.string(),
  technicalImplementation: z.string(),
  appliedMethodology: z.literal('TRIZ'),
  ragCitations: z.array(RagCitationSchema),
});

const RealityCheckAlertSchema = z.object({
  severity: z.enum(['WARNING', 'CRITICAL_FAILURE']),
  violatedConstraint: z.string(),
  reason: z.string(),
  ragCitation: RagCitationSchema.optional(),
});

const CandidateEvaluationSchema = z.object({
  candidateId: z.string(),
  score: z.number(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  realityCheckAlerts: z.array(RealityCheckAlertSchema),
});

const EvaluationSchema = z.object({
  status: z.literal('COMPLETED'),
  evaluations: z.array(CandidateEvaluationSchema),
});

const RejectedAlternativeSchema = z.object({
  candidateId: z.string(),
  rejectionReason: z.string(),
});

const FinalRecommendationSchema = z.object({
  status: z.literal('COMPLETED'),
  winningCandidateId: z.string(),
  winnerDetails: CandidateGenerationSchema,
  explainabilityReport: z.object({
    whyItWon: z.string(),
    howItSolvesContradiction: z.string(),
    complianceWithConstraints: z.string(),
  }),
  rejectedAlternativesSummary: z.array(RejectedAlternativeSchema),
  nextSteps: z.array(z.string()),
});

// ==========================================
// SUB-AGENTS DEFINITIONS
// ==========================================

const goalExtractionInstruction = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving) and dynamic R&D pipeline orchestration.

Your task is to extract the user's primary engineering goal from their problem context and domain parameters.
`;

const goalExtractionAgent = new LlmAgent({
  name: 'goal_extraction',
  model: 'gemini-2.5-flash',
  instruction: goalExtractionInstruction,
  outputSchema: GoalExtractionSchema,
});

const contradictionSolverInstruction = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving) and dynamic R&D pipeline orchestration.

Your task is to identify contradictions.
First, call search_parameter to find the improving and worsening parameter IDs from the TRIZ matrix (numeric IDs 1 to 39).
Second, call browse_contradiction_matrix with those parameters to find the Inventive Principles.
Third, use get_principle_by_id to fetch details for the principles you want to apply.
`;

const contradictionSolverAgent = new LlmAgent({
  name: 'contradiction_solver',
  model: 'gemini-2.5-flash',
  instruction: contradictionSolverInstruction,
  tools: [trizToolset],
  outputSchema: ContradictionSolverSchema,
});

const candidateGenerationInstruction = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving) and dynamic R&D pipeline orchestration.

Your task is to formulate a single candidate solution applying the selected inventive principles for a specific category (SHORT_TERM_EASY or LONG_TERM_HIGH_IMPACT). Provide realistic RAG citations (title, urlOrDoi, relevantExcerpt) to support this.
`;

const candidateGenerationAgent = new LlmAgent({
  name: 'candidate_generation',
  model: 'gemini-2.5-flash',
  instruction: candidateGenerationInstruction,
  outputSchema: CandidateGenerationSchema,
});

const evaluationInstruction = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving) and dynamic R&D pipeline orchestration.

Your task is to evaluate each candidate against the hard constraints and domain parameters. Check if any candidate violates a constraint (Reality Check) and generate WARNING or CRITICAL_FAILURE alerts if so, including RAG citations to prove the failure. Rate each candidate out of 100, and list pros and cons.
`;

const evaluationAgent = new LlmAgent({
  name: 'evaluation',
  model: 'gemini-2.5-flash',
  instruction: evaluationInstruction,
  outputSchema: EvaluationSchema,
});

const finalRecommendationInstruction = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving) and dynamic R&D pipeline orchestration.

Your task is to select the winning candidate. Formulate the explainability report, list rejected alternatives with their reasons, and outline next steps.
`;

const finalRecommendationAgent = new LlmAgent({
  name: 'final_recommendation',
  model: 'gemini-2.5-flash',
  instruction: finalRecommendationInstruction,
  outputSchema: FinalRecommendationSchema,
});

// ==========================================
// ROUTED AGENT (PIPELINE COORDINATOR)
// ==========================================

export const rootAgent = new RoutedAgent({
  name: 'root_agent',
  agents: [
    goalExtractionAgent,
    contradictionSolverAgent,
    candidateGenerationAgent,
    evaluationAgent,
    finalRecommendationAgent,
  ],
  router: (agents, context) => {
    const text = context.userContent?.parts?.[0]?.text || '';
    if (text.includes('[SUB-TASK: GOAL_EXTRACTION]')) {
      return 'goal_extraction';
    }
    if (text.includes('[SUB-TASK: CONTRADICTION_SOLVER]')) {
      return 'contradiction_solver';
    }
    if (text.includes('[SUB-TASK: CANDIDATE_GENERATION]')) {
      return 'candidate_generation';
    }
    if (text.includes('[SUB-TASK: EVALUATION]')) {
      return 'evaluation';
    }
    if (text.includes('[SUB-TASK: FINAL_RECOMMENDATION]')) {
      return 'final_recommendation';
    }
    return 'goal_extraction';
  },
});
