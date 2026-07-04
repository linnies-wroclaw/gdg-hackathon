import {
  EXIT_LOOP,
  LlmAgent,
  LoopAgent,
  MCPToolset,
  SequentialAgent,
  type StreamableHTTPConnectionParams,
} from '@google/adk';

const model = 'gemini-2.5-flash';
const mcpUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';

const connectionParams: StreamableHTTPConnectionParams = {
  type: 'StreamableHTTPConnectionParams',
  url: mcpUrl,
};

const trizToolset = new MCPToolset(connectionParams);

const problemExtractorInstruction = `
You are a precise problem-framing agent.

Your job is to extract the core problem from the user's request so downstream solver agents solve the right thing.

Return only this structure:
# Reasoning
2-4 sentences explaining why you framed the problem this way and what you deliberately excluded.

# Core Problem
A one-sentence statement of the real problem to solve.

# Key Constraints
- The concrete constraints that shape acceptable solutions.

# Downstream Symptoms
1. First observable symptom of the problem.
2. Second observable symptom.
(3 to 6 numbered, concrete, observable symptoms. Downstream agents score symptom coverage against exactly this list, so include every symptom the user reported or that necessarily follows.)

# Success Criteria
- The signals that would make a solution successful.

Preserve domain-specific details. Remove incidental wording and emotional phrasing.
`;

const whyStepInstruction = `
You are the "why" step of a 5 Whys root-cause analysis loop.

Problem under analysis:
{core_problem}

Causal chain so far (JSON; empty on the first iteration):
{causal_chain?}

Do exactly one thing this turn:
1. Take the most recent "because" (or the Core Problem if the chain is empty) and ask WHY it happens.
2. Answer with the single most defensible direct cause.
3. Rate link_validity as an integer 1-5 (5 = direct verified mechanism, 1 = correlation dressed as cause) and justify the rating in that link's "reasoning" field.
4. Decide whether this cause is a terminal root cause: a process, design, or policy choice where asking "why" again would leave the problem domain.

Output ONLY a raw JSON object - no markdown fences, no prose before or after - containing the FULL chain (all previous links copied unchanged, plus exactly one new link):
{"chain":[{"why":"...","because":"...","link_validity":4,"reasoning":"..."}],"root_cause_reached":false}

If the new cause is a terminal root cause, set "root_cause_reached" to true and call the exit_loop tool.
Never add more than one new link per turn. Never modify previous links.
`;

const fiveYSolverInstruction = `
You are BuildWithAI-FiveY-Solver, a practical implementation agent.

Extracted problem:
{core_problem}

Validated causal chain from the 5 Whys loop:
{causal_chain}

Your job is to always provide usable solution candidates from the causal chain. Do not refuse or stop at analysis. If information is incomplete, state the assumption in each candidate's reasoning and still produce practical solutions.

Generate 3 to 5 candidate solutions. Each candidate must directly intervene on a causal-chain link and must be specific enough that a hackathon team can start building it. Favor operational fixes, workflow changes, instrumentation, prototypes, or product features that attack root causes revealed by Five Whys.

Output format - first the reasoning section:
# Reasoning
3-6 sentences explaining which chain links are strongest, where intervention is most direct, and how you chose the candidates.

Then a fenced json code block containing ONLY the candidate array:
\`\`\`json
[
  {
    "id": "fy1",
    "title": "concise title",
    "summary": "2-3 sentence concrete implementation idea",
    "source": "fiveY",
    "causal_chain": [exact copy of the chain links from the 5 Whys JSON],
    "intervention_index": 1,
    "rcd": 4,
    "ccv": 4,
    "triz": {"benefit": 4, "cost": 2, "harm": 1, "contradiction_resolution": 3},
    "downstream_symptoms_total": 3,
    "downstream_symptoms_resolved": 2,
    "feasibility": {"buildable_48h": true, "deployable": true},
    "contradiction_sentence": "Names the practical tension this candidate resolves.",
    "principles_used": ["5 Whys root-cause intervention"],
    "reasoning": "Why this chain link, score, and 48-hour feasibility assessment are defensible."
  }
]
\`\`\`

Scoring discipline:
- Every candidate MUST include "source": "fiveY".
- Return at least 3 records and at most 5 records.
- Always include a concrete solution, not just diagnostics.
- Use integers 1-5 for rcd, ccv, benefit, cost, harm, and contradiction_resolution.
- ccv MUST equal the minimum link_validity across the causal chain.
- downstream_symptoms_total MUST equal the number of extractor Downstream Symptoms.
`;

const trizInstruction = `
You are BuildWithAI-TRIZ, an engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving).

Extracted problem (includes the numbered Downstream Symptoms list):
{core_problem}

Validated causal chain from the 5 Whys loop (JSON):
{causal_chain}

Work in this order:
1. Identify the core technical contradiction behind the root cause: the improving parameter versus the worsening or preserved parameter.
2. Query the TRIZ MCP tools before writing candidates: call search_parameter to find engineering parameter IDs, then browse_contradiction_matrix with the improving and preserving IDs, then get_principle_by_id or search_principle for details. Never pretend a tool succeeded when it failed.
3. Generate 3 to 5 candidate solutions. Each candidate acts on one specific link of the causal chain: intervention_index is the 0-based index into the chain (0 = surface symptom link, last index = root cause link).

You must always provide some kind of solution. If one or more TRIZ tools fail or return weak matches, say so in # Reasoning, make a reasonable TRIZ-informed assumption, and still emit 3 to 5 candidate records.

Output format - first the reasoning section:
# Reasoning
3-6 sentences: which contradiction you chose and why, which principles the matrix suggested, and why you picked these intervention points.

Then a fenced json code block containing ONLY the candidate array:
\`\`\`json
[
  {
    "id": "c1",
    "title": "concise title",
    "summary": "2-3 sentence concrete implementation idea",
    "source": "triz",
    "causal_chain": [exact copy of the chain links from the 5 Whys JSON],
    "intervention_index": 1,
    "rcd": 4,
    "ccv": 4,
    "triz": {"benefit": 4, "cost": 2, "harm": 1, "contradiction_resolution": 4},
    "downstream_symptoms_total": 3,
    "downstream_symptoms_resolved": 2,
    "feasibility": {"buildable_48h": true, "deployable": true},
    "contradiction_sentence": "One sentence naming the contradiction this candidate resolves.",
    "principles_used": ["#1 Segmentation"],
    "reasoning": "Why these scores and this intervention point."
  }
]
\`\`\`

Scoring discipline (all integers 1-5):
- Every candidate MUST include "source": "triz".
- Return at least 3 records and at most 5 records.
- Always include a concrete solution, not just diagnostics.
- rcd: how deep the fix bites into the chain (5 = acts on the terminal root cause).
- ccv: MUST equal the minimum link_validity across the causal chain.
- benefit, cost, harm: practical magnitudes for this problem context.
- contradiction_resolution: 1 = mere trade-off, 5 = contradiction fully dissolved.
- downstream_symptoms_total: MUST equal the number of items in the extractor's Downstream Symptoms list; downstream_symptoms_resolved counts how many of those this candidate eliminates.
- feasibility.buildable_48h: a working prototype fits in 48 hours; feasibility.deployable: usable in the target operational environment.
`;

const problemExtractorAgent = new LlmAgent({
  name: 'problem_extractor',
  model,
  instruction: problemExtractorInstruction,
  outputKey: 'core_problem',
});

const whyStepAgent = new LlmAgent({
  name: 'why_step',
  model,
  instruction: whyStepInstruction,
  tools: [EXIT_LOOP],
  outputKey: 'causal_chain',
});

const fiveYAgent = new LoopAgent({
  name: 'fiveY',
  maxIterations: 5,
  subAgents: [whyStepAgent],
});

const fiveYSolverAgent = new LlmAgent({
  name: 'fiveY_solver',
  model,
  instruction: fiveYSolverInstruction,
  outputKey: 'fiveY_candidate_records',
});

const trizAgent = new LlmAgent({
  name: 'triz_solver',
  model,
  instruction: trizInstruction,
  tools: [trizToolset],
  outputKey: 'candidate_records',
});

export const rootAgent = new SequentialAgent({
  name: 'root_agent',
  subAgents: [problemExtractorAgent, fiveYAgent, fiveYSolverAgent, trizAgent],
});
