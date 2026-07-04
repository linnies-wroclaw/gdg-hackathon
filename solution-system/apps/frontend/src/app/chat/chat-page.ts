import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
  viewChildren,
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
import { ChatService } from './chat.service';
import { MarkdownPipe } from './markdown.pipe';
import { AgentTrace, ScoredCandidate } from './chat.types';

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
  selector: 'app-chat-page',
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  imports: [MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  protected readonly chat = inject(ChatService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly logRef = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly inputRef =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private readonly planeCanvases =
    viewChildren<ElementRef<HTMLCanvasElement>>('planeCanvas');
  private readonly charts = new Map<HTMLCanvasElement, Chart<'scatter'>>();

  constructor() {
    void this.chat.loadChats();

    this.destroyRef.onDestroy(() => {
      for (const chart of this.charts.values()) {
        chart.destroy();
      }
      this.charts.clear();
    });

    afterRenderEffect(() => {
      this.chat.messages();
      this.chat.pending();
      const log = this.logRef().nativeElement;
      log.scrollTo?.({ top: log.scrollHeight });
      this.renderCharts();
    });
  }

  protected hasTraceView(trace: AgentTrace | undefined): trace is AgentTrace {
    return Boolean(
      trace &&
        (trace.topTrizCandidates.length > 0 ||
          trace.topFiveYCandidates.length > 0 ||
          trace.candidates.length > 0),
    );
  }

  protected chartLabel(candidate: ScoredCandidate): string {
    return `${candidate.record.id}: ${candidate.record.title}`;
  }

  protected scoreLabel(value: number): string {
    return value.toFixed(1);
  }

  protected percentLabel(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  protected createChat(): void {
    void this.chat.createChat();
    this.focusInput();
  }

  protected selectChat(chatId: number): void {
    if (this.chat.selectedChatId() === chatId || this.chat.pending()) {
      return;
    }

    void this.chat.selectChat(chatId);
    this.focusInput();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.sendCurrent();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendCurrent();
    }
  }

  protected onInput(): void {
    this.resizeInput();
  }

  private sendCurrent(): void {
    const textarea = this.inputRef().nativeElement;
    if (!textarea.value.trim() || this.chat.pending()) {
      return;
    }
    void this.chat.send(textarea.value);
    textarea.value = '';
    this.resizeInput();
    this.focusInput();
  }

  private resizeInput(): void {
    const textarea = this.inputRef().nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  private focusInput(): void {
    this.inputRef().nativeElement.focus();
  }

  private renderCharts(): void {
    const activeCanvases = new Set<HTMLCanvasElement>();

    for (const canvasRef of this.planeCanvases()) {
      const canvas = canvasRef.nativeElement;
      activeCanvases.add(canvas);

      if (this.charts.has(canvas)) {
        continue;
      }

      const trace = this.findTraceForCanvas(canvas);
      const context = canvas.getContext('2d');

      if (!trace || !context) {
        continue;
      }

      this.charts.set(canvas, new Chart(context, this.chartConfig(trace)));
    }

    for (const [canvas, chart] of this.charts) {
      if (!activeCanvases.has(canvas)) {
        chart.destroy();
        this.charts.delete(canvas);
      }
    }
  }

  private findTraceForCanvas(canvas: HTMLCanvasElement): AgentTrace | null {
    const index = Number(canvas.dataset['traceIndex']);
    const message = this.chat.messages()[index];

    return message?.trace ?? null;
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
