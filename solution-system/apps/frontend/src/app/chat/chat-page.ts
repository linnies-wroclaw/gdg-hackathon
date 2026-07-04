import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from './chat.service';
import { SubmitProblemRequestDto } from './chat.types';

interface DynamicParam {
  key: string;
  value: string;
}

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  protected readonly chat = inject(ChatService);

  // Form State
  protected problemContext = signal('Hull breach in Arctic waters, crude oil leaking. Need to seal the leak immediately, but cannot dry-dock the vessel due to remote location and heavy storms.');
  protected selectedConstraints = signal<string[]>(['Zero Dry-Docking', 'Arctic temperatures']);
  
  // Dynamic parameters (the Joker field)
  protected domainParams = signal<DynamicParam[]>([
    { key: 'environment', value: 'Arctic' },
    { key: 'vesselMass', value: '300000' }
  ]);

  // Pre-defined constraints list
  protected availableConstraints = [
    'Zero Dry-Docking',
    'Arctic temperatures',
    'IMO Compliance',
    'Low CapEx',
    'No specialized crew required'
  ];

  // UI Navigation State
  protected activeCategory = signal<'SHORT_TERM_EASY' | 'LONG_TERM_HIGH_IMPACT'>('SHORT_TERM_EASY');
  protected expandedCitations = signal<Record<string, boolean>>({});

  private readonly rightPaneRef = viewChild<ElementRef<HTMLElement>>('rightPane');

  constructor() {
    // Auto-scroll the right pane when new trail content appears
    afterRenderEffect(() => {
      const trail = this.chat.trail();
      const pane = this.rightPaneRef()?.nativeElement;
      if (pane) {
        pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
      }
    });
  }

  protected loadPreset(preset: 'SDG14' | 'SDG12'): void {
    if (preset === 'SDG14') {
      this.problemContext.set('Hull breach in Arctic waters, crude oil leaking. Need to seal the leak immediately, but cannot dry-dock the vessel due to remote location and heavy storms.');
      this.selectedConstraints.set(['Zero Dry-Docking', 'Arctic temperatures']);
      this.domainParams.set([
        { key: 'environment', value: 'Arctic' },
        { key: 'vesselMass', value: '300000' }
      ]);
    } else if (preset === 'SDG12') {
      this.problemContext.set('PCB (polychlorinated biphenyls) disposal bottleneck at electronics recycling plant. High risk of chemical runoff into soil during upcoming seasonal storms.');
      this.selectedConstraints.set(['Low CapEx', 'No specialized crew required']);
      this.domainParams.set([
        { key: 'materialType', value: 'PCB' },
        { key: 'annualVolumeTons', value: '50000' },
        { key: 'facilityType', value: 'Landfill-adjacent' }
      ]);
    }
  }

  protected addParam(): void {
    this.domainParams.update(params => [...params, { key: '', value: '' }]);
  }

  protected removeParam(index: number): void {
    this.domainParams.update(params => params.filter((_, i) => i !== index));
  }

  protected updateParamKey(index: number, key: string): void {
    this.domainParams.update(params => {
      const updated = [...params];
      updated[index] = { ...updated[index], key };
      return updated;
    });
  }

  protected updateParamValue(index: number, value: string): void {
    this.domainParams.update(params => {
      const updated = [...params];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  }

  protected toggleConstraint(constraint: string): void {
    const current = this.selectedConstraints();
    if (current.includes(constraint)) {
      this.selectedConstraints.set(current.filter(c => c !== constraint));
    } else {
      this.selectedConstraints.set([...current, constraint]);
    }
  }

  protected setCategory(category: 'SHORT_TERM_EASY' | 'LONG_TERM_HIGH_IMPACT'): void {
    this.activeCategory.set(category);
  }

  protected toggleCitation(citationId: string): void {
    const current = this.expandedCitations();
    this.expandedCitations.set({
      ...current,
      [citationId]: !current[citationId]
    });
  }

  protected onSolveSubmit(event: Event): void {
    event.preventDefault();
    const context = this.problemContext().trim();
    if (!context || this.chat.pending()) {
      return;
    }

    // Convert dynamic parameters back to Record<string, any>
    const parametersRecord: Record<string, any> = {};
    for (const p of this.domainParams()) {
      const key = p.key.trim();
      const valStr = p.value.trim();
      if (key) {
        // Try parsing value to number if appropriate
        const num = Number(valStr);
        parametersRecord[key] = (isNaN(num) || valStr === '') ? valStr : num;
      }
    }

    const request: SubmitProblemRequestDto = {
      problemContext: context,
      domainParameters: parametersRecord,
      hardConstraints: this.selectedConstraints()
    };

    void this.chat.solve(request);
  }
}
