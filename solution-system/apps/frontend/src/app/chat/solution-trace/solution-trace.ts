import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  Chart,
  type ChartConfiguration,
  type ChartDataset,
  type Plugin,
  type ScatterDataPoint,
  Legend,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip,
} from 'chart.js';
import { AgentTrace, ScoredCandidate } from '../chat.types';

Chart.register(ScatterController, LinearScale, PointElement, Tooltip, Legend);

const gateLinePlugin: Plugin<'scatter'> = {
  id: 'gate-lines',
  afterDraw(chart) {
    const xScale = chart.scales['x'];
    const yScale = chart.scales['y'];

    if (!xScale || !yScale) {
      return;
    }

    const ctx = chart.ctx;
    const xGate = xScale.getPixelForValue(60);
    const yGate = yScale.getPixelForValue(60);

    ctx.save();
    ctx.strokeStyle = '#7c8a9a';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(xGate, chart.chartArea.top);
    ctx.lineTo(xGate, chart.chartArea.bottom);
    ctx.moveTo(chart.chartArea.left, yGate);
    ctx.lineTo(chart.chartArea.right, yGate);
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(gateLinePlugin);

@Component({
  selector: 'app-solution-trace',
  standalone: true,
  templateUrl: './solution-trace.html',
  styleUrl: './solution-trace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolutionTraceComponent {
  trace = input.required<AgentTrace>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly planeCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('planeCanvas');
  private chart: Chart<'scatter'> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
    });

    afterRenderEffect(() => {
      const traceData = this.trace();
      const canvas = this.planeCanvas().nativeElement;
      const context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      if (this.chart) {
        this.chart.destroy();
      }

      this.chart = new Chart(context, this.chartConfig(traceData));
    });
  }

  protected scoreLabel(value: number): string {
    return value.toFixed(1);
  }

  protected percentLabel(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private chartConfig(trace: AgentTrace): ChartConfiguration<'scatter'> {
    const winnerId = trace.evaluation?.winnerId;
    const dataset = (
      label: string,
      candidates: ScoredCandidate[],
      color: string,
    ): ChartDataset<'scatter', ScatterDataPoint[]> => ({
      label,
      data: candidates.map((candidate) => ({
        x: candidate.x,
        y: candidate.y,
      })),
      pointBackgroundColor: candidates.map((candidate) =>
        candidate.record.id === winnerId ? '#0f766e' : color,
      ),
      pointBorderColor: candidates.map((candidate) =>
        candidate.record.id === winnerId ? '#042f2e' : '#ffffff',
      ),
      pointBorderWidth: 2,
      pointRadius: candidates.map((candidate) =>
        candidate.record.id === winnerId ? 7 : 5,
      ),
      pointHoverRadius: 8,
    });

    return {
      type: 'scatter',
      data: {
        datasets: [
          dataset(
            'TRIZ',
            trace.candidates.filter((candidate) => candidate.record.source === 'triz'),
            '#2563eb',
          ),
          dataset(
            'Five-Whys',
            trace.candidates.filter((candidate) => candidate.record.source === 'fiveY'),
            '#c2410c',
          ),
        ],
      },
      options: {
        animation: false,
        events: ['mousemove', 'mouseout', 'click'],
        parsing: false,
        responsive: false,
        maintainAspectRatio: true,
        scales: {
          x: {
            min: 0,
            max: 100,
            title: { display: true, text: 'X targeting' },
          },
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Y quality' },
          },
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const candidates =
                  context.dataset.label === 'TRIZ'
                    ? trace.candidates.filter(
                        (candidate) => candidate.record.source === 'triz',
                      )
                    : trace.candidates.filter(
                        (candidate) => candidate.record.source === 'fiveY',
                      );
                const candidate = candidates[context.dataIndex];

                return candidate
                  ? `${candidate.record.title}: X ${candidate.x.toFixed(1)}, Y ${candidate.y.toFixed(1)}`
                  : '';
              },
            },
          },
        },
      },
    };
  }
}
