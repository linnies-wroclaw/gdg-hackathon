import { CausalLink, EvaluationResult } from '../trace/trace.types';

export function renderReport(
  evaluation: EvaluationResult | null,
  chain: CausalLink[] | null,
  failureReason?: string,
): string {
  if (!evaluation) {
    return [
      '# Evaluation Unavailable',
      '',
      failureReason ?? 'The run did not produce evaluable data.',
    ].join('\n');
  }

  const lines: string[] = ['# Decision', '', evaluation.verdict];
  const winner = evaluation.candidates.find(
    (candidate) => candidate.record.id === evaluation.winnerId,
  );

  if (winner) {
    lines.push(
      '',
      `## Winner: ${winner.record.title} (${winner.record.id})`,
      '',
      `- X_targeting: ${winner.x.toFixed(1)} / Y_quality: ${winner.y.toFixed(1)} (gates: ${evaluation.gateX}/${evaluation.gateY})`,
      `- Symptom coverage (dc): ${(winner.dc * 100).toFixed(0)}%`,
      `- Contradiction: ${winner.record.contradiction_sentence}`,
      '',
      winner.record.summary,
    );

    if (chain && chain.length > 0) {
      lines.push('', '### Causal chain it acts on');
      chain.forEach((link, index) => {
        const marker =
          index === winner.record.intervention_index
            ? ' <- intervention point'
            : '';
        lines.push(
          `${index + 1}. ${link.why} - ${link.because} (validity ${link.link_validity})${marker}`,
        );
      });
    }
  }

  lines.push(
    '',
    '## Candidate plane',
    '',
    '| id | title | X | Y | dc | feasible | frontier | gates |',
    '|---|---|---|---|---|---|---|---|',
  );

  for (const candidate of evaluation.candidates) {
    lines.push(
      `| ${candidate.record.id} | ${candidate.record.title} | ${candidate.x.toFixed(1)} | ${candidate.y.toFixed(1)} | ${(candidate.dc * 100).toFixed(0)}% | ${flag(candidate.feasible)} | ${flag(candidate.onFrontier)} | ${flag(candidate.passesGates)} |`,
    );
  }

  return lines.join('\n');
}

function flag(value: boolean): string {
  return value ? 'yes' : 'no';
}
