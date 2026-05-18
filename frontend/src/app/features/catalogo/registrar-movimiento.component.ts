import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductoDto } from '../../core/models/catalogo.models';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="rm-form" [formGroup]="form" (ngSubmit)="onSubmit()">
      @if (errorMsg()) {
        <p class="rm-error" role="alert">{{ errorMsg() }}</p>
      }
      <label class="rm-field">
        <span class="rm-label">Tipo</span>
        <select formControlName="tipo" class="rm-input">
          <option value="ENTRADA">Entrada (compra, devolución…)</option>
          <option value="SALIDA">Salida (venta, consumo…)</option>
          <option value="AJUSTE">Ajuste (fijar stock total)</option>
        </select>
      </label>
      <label class="rm-field">
        <span class="rm-label">{{ cantidadLabel() }}</span>
        <input type="number" class="rm-input" formControlName="cantidad" min="0" step="1" />
      </label>
      <label class="rm-field">
        <span class="rm-label">Nota (opcional)</span>
        <input type="text" class="rm-input" formControlName="observacion" maxlength="500" />
      </label>
      <button type="submit" class="rm-submit" [disabled]="form.invalid || submitting()">
        {{ submitting() ? 'Guardando…' : 'Registrar' }}
      </button>
    </form>
  `,
  styles: `
    .rm-form {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      max-width: 22rem;
    }
    .rm-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.88rem;
    }
    .rm-label {
      color: var(--story-text-muted, #64748b);
      font-weight: 500;
    }
    .rm-input {
      padding: 0.45rem 0.5rem;
      border: 1px solid var(--story-border-strong, #cbd5e1);
      border-radius: 6px;
      font: inherit;
      background: var(--story-surface, #fff);
      color: var(--story-text, #1e293b);
    }
    .rm-input:focus-visible {
      outline: 2px solid var(--story-focus-ring, rgba(59, 130, 246, 0.45));
      outline-offset: 1px;
    }
    .rm-error {
      margin: 0;
      font-size: 0.86rem;
      color: var(--story-danger, #b91c1c);
    }
    .rm-submit {
      margin-top: 0.25rem;
      width: fit-content;
      padding: 0.45rem 1rem;
      border: none;
      border-radius: 6px;
      background: var(--story-primary, #1e40af);
      color: var(--story-on-primary, #fff);
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      transition: background 0.18s ease;
    }
    .rm-submit:hover:not(:disabled) {
      background: var(--story-primary-hover, #1d4ed8);
    }
    .rm-submit:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class RegistrarMovimientoComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CatalogoApiService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) producto!: ProductoDto;
  @Output() readonly completado = new EventEmitter<void>();

  protected readonly submitting = signal(false);
  protected readonly errorMsg = signal('');

  protected readonly form = this.fb.nonNullable.group({
    tipo: this.fb.nonNullable.control<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA'),
    cantidad: this.fb.nonNullable.control(1, {
      validators: [Validators.required, Validators.min(1)],
    }),
    observacion: this.fb.nonNullable.control(''),
  });

  constructor() {
    this.form
      .get('tipo')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => {
        const cCtrl = this.form.get('cantidad');
        if (t === 'AJUSTE') {
          cCtrl?.setValidators([Validators.required, Validators.min(0)]);
          this.form.patchValue(
            { cantidad: this.producto?.cantidad ?? 0 },
            { emitEvent: false },
          );
        } else {
          cCtrl?.setValidators([Validators.required, Validators.min(1)]);
          this.form.patchValue({ cantidad: 1 }, { emitEvent: false });
        }
        cCtrl?.updateValueAndValidity({ emitEvent: false });
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['producto']?.currentValue || !this.producto) {
      return;
    }
    if (this.form.getRawValue().tipo !== 'AJUSTE') {
      return;
    }
    this.form.patchValue({ cantidad: this.producto.cantidad }, { emitEvent: false });
    this.form.get('cantidad')?.updateValueAndValidity({ emitEvent: false });
  }

  protected cantidadLabel(): string {
    const t = this.form.getRawValue().tipo;
    return t === 'AJUSTE' ? 'Nuevo stock total (uds.)' : 'Unidades';
  }

  protected onSubmit(): void {
    if (this.form.invalid || !this.producto) return;
    const v = this.form.getRawValue();
    const obs = v.observacion.trim();
    this.submitting.set(true);
    this.errorMsg.set('');
    this.api
      .registrarMovimiento(this.producto.id, {
        tipo: v.tipo,
        cantidad: v.cantidad,
        observacion: obs ? obs : undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.patchValue({
            tipo: 'ENTRADA',
            cantidad: 1,
            observacion: '',
          });
          const cCtrl = this.form.get('cantidad');
          cCtrl?.setValidators([Validators.required, Validators.min(1)]);
          cCtrl?.updateValueAndValidity({ emitEvent: false });
          this.completado.emit();
        },
        error: (err: { error?: { message?: string } }) => {
          this.submitting.set(false);
          const msg = err?.error?.message;
          this.errorMsg.set(
            typeof msg === 'string' ? msg : 'No se pudo registrar el movimiento',
          );
        },
      });
  }
}
