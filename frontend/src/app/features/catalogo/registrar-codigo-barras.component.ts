import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OpenFoodFactsProductDto, formatAlergenoTag } from '../../core/models/catalogo.models';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';
import { OpenFoodFactsApiService } from '../../core/services/open-food-facts-api.service';

@Component({
  selector: 'app-registrar-codigo-barras',
  standalone: true,
  imports: [ReactiveFormsModule, UpperCasePipe],
  template: `
    <form class="rcb-form" [formGroup]="form" (ngSubmit)="onSubmit()">
      @if (errorMsg()) {
        <p class="rcb-error" role="alert">{{ errorMsg() }}</p>
      }
      <label class="rcb-field">
        <span class="rcb-label">Código de barras (EAN/GTIN)</span>
        <input
          type="text"
          class="rcb-input"
          formControlName="codigoBarras"
          inputmode="numeric"
          autocomplete="off"
          placeholder="p. ej. 3017624010701"
        />
      </label>
      <button
        type="button"
        class="rcb-search"
        [disabled]="searching() || !form.controls.codigoBarras.value.trim()"
        (click)="buscarOff()"
      >
        {{ searching() ? 'Buscando…' : 'Buscar en Open Food Facts' }}
      </button>
      @if (preview(); as off) {
        <div class="rcb-preview" aria-live="polite">
          <p class="rcb-preview-name">{{ off.nombre }}</p>
          @if (off.imagenUrl) {
            <img [src]="off.imagenUrl" alt="" class="rcb-preview-img" />
          }
          @if (off.nutriScore) {
            <span class="story-nutri" [class]="nutriClass(off.nutriScore)">
              Nutri-Score {{ off.nutriScore | uppercase }}
            </span>
          }
          @if (off.alergenos.length) {
            <div class="story-allergen-tags">
              @for (tag of off.alergenos; track tag) {
                <span class="story-allergen-tag">{{ formatAlergenoTag(tag) }}</span>
              }
            </div>
          }
        </div>
      }
      <div class="rcb-actions">
        <button type="submit" class="rcb-submit" [disabled]="!preview() || submitting()">
          {{ submitting() ? 'Guardando…' : 'Guardar código de barras' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .rcb-form {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      max-width: 24rem;
    }
    .rcb-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.88rem;
    }
    .rcb-label {
      color: var(--story-text-muted, #64748b);
      font-weight: 500;
    }
    .rcb-input {
      padding: 0.45rem 0.5rem;
      border: 1px solid var(--story-border-strong, #cbd5e1);
      border-radius: 6px;
      font: inherit;
      background: var(--story-surface, #fff);
      color: var(--story-text, #1e293b);
    }
    .rcb-search {
      align-self: flex-start;
      padding: 0.45rem 0.85rem;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      border: 1px solid var(--story-border, #e2e8f0);
      border-radius: 8px;
      background: var(--story-bg-page, #f8fafc);
      color: var(--story-text, #1e293b);
      cursor: pointer;
    }
    .rcb-search:hover:not(:disabled) {
      background: var(--story-surface, #fff);
    }
    .rcb-search:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .rcb-preview {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.65rem;
      border: 1px solid var(--story-border, #e2e8f0);
      border-radius: 8px;
      background: var(--story-bg-page, #f8fafc);
    }
    .rcb-preview-name {
      margin: 0;
      font-weight: 600;
      font-size: 0.92rem;
    }
    .rcb-preview-img {
      max-width: 120px;
      max-height: 120px;
      object-fit: contain;
      border-radius: 6px;
      background: #fff;
    }
    .rcb-error {
      margin: 0;
      font-size: 0.86rem;
      color: var(--story-danger, #b91c1c);
    }
    .rcb-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .rcb-submit {
      padding: 0.45rem 1rem;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      background: var(--story-primary, #1e40af);
      color: var(--story-on-primary, #fff);
    }
    .rcb-submit:hover:not(:disabled) {
      background: var(--story-primary-hover, #1d4ed8);
    }
    .rcb-submit:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class RegistrarCodigoBarrasComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CatalogoApiService);
  private readonly offApi = inject(OpenFoodFactsApiService);

  @Input({ required: true }) productoId!: number;

  @Output() readonly completado = new EventEmitter<void>();
  @Output() readonly cancelar = new EventEmitter<void>();

  protected readonly formatAlergenoTag = formatAlergenoTag;
  protected readonly searching = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly preview = signal<OpenFoodFactsProductDto | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    codigoBarras: this.fb.nonNullable.control('', Validators.required),
  });

  protected nutriClass(score: string): string {
    return `story-nutri--${score.trim().charAt(0).toLowerCase()}`;
  }

  protected buscarOff(): void {
    const code = this.form.controls.codigoBarras.value.trim();
    if (!code) return;
    this.searching.set(true);
    this.errorMsg.set('');
    this.preview.set(null);
    this.offApi.buscarProducto(code).subscribe({
      next: (off) => {
        this.preview.set(off);
        this.form.patchValue({ codigoBarras: off.codigoBarras });
        this.searching.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.searching.set(false);
        const msg = err?.error?.message;
        this.errorMsg.set(
          typeof msg === 'string' ? msg : 'Producto no encontrado en Open Food Facts',
        );
      },
    });
  }

  protected onCancel(): void {
    this.cancelar.emit();
  }

  protected onSubmit(): void {
    const off = this.preview();
    if (!off || this.productoId == null) return;
    this.submitting.set(true);
    this.errorMsg.set('');
    this.api.registrarCodigoBarras(this.productoId, off.codigoBarras).subscribe({
      next: () => {
        this.submitting.set(false);
        this.completado.emit();
      },
      error: (err: { error?: { message?: string } }) => {
        this.submitting.set(false);
        const msg = err?.error?.message;
        this.errorMsg.set(
          typeof msg === 'string' ? msg : 'No se pudo guardar el código de barras',
        );
      },
    });
  }
}
