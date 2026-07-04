import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatPage } from './chat-page';
import { ChatService } from './chat.service';
import { AgentTrace, ScoredCandidate } from './chat.types';

const scored = (
  id: string,
  source: 'triz' | 'fiveY',
  x: number,
  y: number,
): ScoredCandidate => ({
  record: {
    id,
    title: `${source} ${id}`,
    summary: `Summary ${id}`,
    source,
    causal_chain: [{ why: 'Why?', because: 'Because.', link_validity: 4 }],
    intervention_index: 0,
    rcd: 4,
    ccv: 4,
    triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
    downstream_symptoms_total: 3,
    downstream_symptoms_resolved: 2,
    feasibility: { buildable_48h: true, deployable: true },
    contradiction_sentence: `Contradiction ${id}`,
  },
  x,
  y,
  dc: 2 / 3,
  ccvComputed: 4,
  feasible: true,
  onFrontier: true,
  passesGates: x >= 60 && y >= 60,
});

const trace: AgentTrace = {
  steps: [],
  causalChain: null,
  candidates: [
    scored('t1', 'triz', 80, 72),
    scored('t2', 'triz', 74, 69),
    scored('t3', 'triz', 68, 65),
    scored('f1', 'fiveY', 79, 70),
    scored('f2', 'fiveY', 71, 67),
    scored('f3', 'fiveY', 64, 62),
  ],
  topTrizCandidates: [
    scored('t1', 'triz', 80, 72),
    scored('t2', 'triz', 74, 69),
    scored('t3', 'triz', 68, 65),
  ],
  topFiveYCandidates: [
    scored('f1', 'fiveY', 79, 70),
    scored('f2', 'fiveY', 71, 67),
    scored('f3', 'fiveY', 64, 62),
  ],
  evaluation: {
    gateX: 60,
    gateY: 60,
    candidates: [],
    frontierIds: ['t1', 'f1'],
    gatedIds: ['t1', 'f1'],
    winnerId: 't1',
    verdict: 'Selected t1.',
  },
  checks: [],
};

describe('ChatPage trace output', () => {
  it('renders top-three solution groups and the XY chart for assistant traces', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const chat = {
      chats: signal([]),
      messages: signal([
        {
          id: 1,
          role: 'assistant' as const,
          text: '# Decision\nSelected t1.',
          trace,
        },
      ]),
      selectedChatId: signal(1),
      pending: signal(false),
      error: signal(null),
      loadChats: vi.fn().mockResolvedValue(undefined),
      createChat: vi.fn().mockResolvedValue(undefined),
      selectChat: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ChatPage],
      providers: [{ provide: ChatService, useValue: chat }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Top TRIZ solutions');
    expect(compiled.textContent).toContain('Top Five-Whys solutions');
    expect(compiled.querySelectorAll('.trace-card')).toHaveLength(6);
    const canvas = compiled.querySelector('.trace-plane canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute('width')).toBe('520');
    expect(canvas?.getAttribute('height')).toBe('220');
  });

  it('renders trace result areas as collapsible sections', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const chat = {
      chats: signal([]),
      messages: signal([
        {
          id: 1,
          role: 'assistant' as const,
          text: 'Selected t1.',
          trace,
        },
      ]),
      selectedChatId: signal(1),
      pending: signal(false),
      error: signal(null),
      loadChats: vi.fn().mockResolvedValue(undefined),
      createChat: vi.fn().mockResolvedValue(undefined),
      selectChat: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ChatPage],
      providers: [{ provide: ChatService, useValue: chat }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const sections = Array.from(
      compiled.querySelectorAll<HTMLDetailsElement>('details.trace__details'),
    );

    expect(sections).toHaveLength(3);
    expect(sections.every((section) => section.open)).toBe(true);
    expect(sections.map((section) => section.querySelector('summary')?.textContent)).toEqual([
      expect.stringContaining('Top TRIZ solutions'),
      expect.stringContaining('Top Five-Whys solutions'),
      expect.stringContaining('Targeting x Quality map'),
    ]);

    sections[0].open = false;
    expect(sections[0].open).toBe(false);
  });

  it('does not show a stale error while a response is still pending', async () => {
    const chat = {
      chats: signal([]),
      messages: signal([{ id: 1, role: 'user' as const, text: 'Question' }]),
      selectedChatId: signal(1),
      pending: signal(true),
      error: signal('Something went wrong - try again.'),
      loadChats: vi.fn().mockResolvedValue(undefined),
      createChat: vi.fn().mockResolvedValue(undefined),
      selectChat: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ChatPage],
      providers: [{ provide: ChatService, useValue: chat }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="alert"]')).toBeNull();
    expect(compiled.textContent).not.toContain('Something went wrong');
  });
});
