import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

@Component({
  selector: 'app-export-format-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="export-menu">
      <button
        type="button"
        class="export-menu-trigger"
        [disabled]="disabled() || busy()"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        [attr.aria-label]="ariaLabel()"
        (click)="onTriggerClick($event)"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="export-menu-icon">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 4v9m0 0 3.5-3.5M12 13 8.5 9.5"
          />
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 20h12"
          />
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 17h8"
          />
        </svg>
      </button>
      @if (open()) {
        <div class="export-menu-panel" role="menu" (click)="$event.stopPropagation()">
          <button type="button" class="export-menu-item" role="menuitem" (click)="pick('csv')">CSV</button>
          <button type="button" class="export-menu-item" role="menuitem" (click)="pick('excel')">Excel</button>
          <button type="button" class="export-menu-item" role="menuitem" (click)="pick('pdf')">PDF</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      position: relative;
    }

    .export-menu {
      position: relative;
      display: inline-flex;
    }

    .export-menu-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.35rem;
      height: 2.35rem;
      padding: 0;
      border: 1px solid var(--story-border, #e2e8f0);
      border-radius: 10px;
      background: #fff;
      color: #0f172a;
      cursor: pointer;
      transition:
        background 0.15s,
        border-color 0.15s,
        color 0.15s;
    }

    .export-menu-trigger:hover:not(:disabled) {
      border-color: var(--story-primary, #1e40af);
      color: var(--story-primary, #1e40af);
      background: rgba(30, 64, 175, 0.06);
    }

    .export-menu-trigger:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .export-menu-icon {
      display: block;
    }

    .export-menu-panel {
      position: absolute;
      top: calc(100% + 0.35rem);
      right: 0;
      z-index: 40;
      min-width: 7.5rem;
      padding: 0.3rem;
      border: 1px solid var(--story-border, #e2e8f0);
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    }

    .export-menu-item {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: #0f172a;
      font-size: 0.86rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }

    .export-menu-item:hover {
      background: rgba(30, 64, 175, 0.08);
      color: var(--story-primary, #1e40af);
    }
  `,
})
export class ExportFormatMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly disabled = input(false);
  readonly busy = input(false);
  readonly ariaLabel = input('Descargar');

  readonly exportCsv = output<void>();
  readonly exportExcel = output<void>();
  readonly exportPdf = output<void>();

  protected readonly open = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  protected onTriggerClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled() || this.busy()) {
      return;
    }
    this.open.update((v) => !v);
  }

  protected pick(kind: ExportFormat): void {
    this.open.set(false);
    switch (kind) {
      case 'csv':
        this.exportCsv.emit();
        break;
      case 'excel':
        this.exportExcel.emit();
        break;
      case 'pdf':
        this.exportPdf.emit();
        break;
    }
  }
}
