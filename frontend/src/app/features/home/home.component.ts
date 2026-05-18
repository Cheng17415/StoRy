import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing">
      <section class="hero" aria-labelledby="landing-title">
        <p class="eyebrow">Inventario y catálogo</p>
        <h1 id="landing-title">StoRy</h1>
        <p class="lede">
          Aplicación web para <strong>gestionar un inventario</strong>: productos,
          categorías y relaciones entre piezas pensada como
          proyecto académico <strong>DAM</strong> utilizando Spring Boot y Angular.
          Como base de datos se utiliza PostgreSQL.
        </p>
        <div class="hero-cta">
          <a routerLink="/register" class="btn-primary">Crear cuenta</a>
          <a routerLink="/login" class="btn-ghost">Ya tengo cuenta</a>
        </div>
      </section>

      <section class="panel" aria-labelledby="why-title">
        <h2 id="why-title">Para qué sirve</h2>
        <p>
          StoRy centraliza la información de tu catálogo: qué artículos existen, cómo se agrupan y, cuando trabajas
          con sesión iniciada, puedes seguir ampliando el uso con <strong>productos</strong>, datos de
          <strong>empresa</strong> y <strong>perfil</strong>. Sirve como referencia única para consultar el inventario
          y mantenerlo alineado con el backend.
        </p>
      </section>

      <section class="features" aria-labelledby="features-title">
        <h2 id="features-title" class="features-heading">Qué puedes hacer</h2>
        <ul class="feature-grid">
          <li class="feature-card">
            <h3>Catálogo claro</h3>
            <p>
              Navega <strong>categorías</strong> y, tras registrarte, explora y gestiona <strong>productos</strong> y
              su detalle.
            </p>
            <a routerLink="/categorias" class="feature-link">Ver categorías públicas</a>
          </li>
          <li class="feature-card">
            <h3>Modelo tipo BOM</h3>
            <p>
              Pensado para inventarios donde importa la <strong>estructura</strong> y la trazabilidad entre ítems, no
              solo un listado plano.
            </p>
          </li>
          <li class="feature-card">
            <h3>Cuenta y empresa</h3>
            <p>
              Con sesión accedes a <strong>empresa</strong> y <strong>perfil</strong> para adaptar el uso a tu
              organización.
            </p>
          </li>
        </ul>
      </section>

      <section class="panel proposal" aria-labelledby="stats-vision-title">
        <h2 id="stats-vision-title">Indicadores y visión operativa</h2>
        <p>
          Cada vez que cambias la cantidad en un producto, StoRy genera un movimiento de
          <strong>entrada</strong> o <strong>salida</strong>. La pantalla <strong>Estadísticas</strong> (visible para
          el administrador de la empresa o para usuarios con rol <strong>analytics_viewer</strong>) agrega esos datos
          por rango de fechas: totales del periodo, serie diaria (por ejemplo, salidas de stock el día X) y un ranking de
          artículos con más unidades retiradas. Las fechas del filtro están en <strong>UTC</strong>, alineadas con el
          registro del servidor. La petición usa el mismo prefijo autenticado que el catálogo:
          <code>/api/productos/estadisticas</code>.
        </p>
        <p class="panel-lead">Líneas posibles para seguir evolucionando el tablero:</p>
        <ul class="proposal-list">
          <li>Objetivos de rotación o salidas máximas por mes y avisos si se superan.</li>
          <li>Exportación CSV o PDF para auditoría o entrega a proveedores.</li>
          <li>Actividad por usuario (quién concentró más movimientos en un periodo).</li>
          <li>Valor aproximado del inventario (cantidad × precio) y comparación entre dos periodos.</li>
        </ul>
        <a routerLink="/login" class="feature-link">Inicia sesión para abrir Estadísticas</a>
      </section>
    </div>
  `,
  styles: `
    .landing {
      max-width: 52rem;
      margin: 0 auto;
      padding-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .hero {
      padding: 1.75rem 1.5rem 1.5rem;
      background: linear-gradient(135deg, var(--story-surface) 0%, #eef2ff 100%);
      border: 1px solid var(--story-border);
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
    }

    .eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--story-primary);
    }

    .hero h1 {
      margin: 0 0 0.75rem;
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--story-text);
    }

    .lede {
      margin: 0 0 1.25rem;
      font-size: 1.05rem;
      line-height: 1.65;
      color: var(--story-text-muted);
      max-width: 46rem;
    }

    .lede strong {
      color: var(--story-text);
      font-weight: 600;
    }

    .hero-cta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
    }

    .btn-primary,
    .btn-ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid transparent;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        color 0.15s ease;
    }

    .btn-primary {
      background: var(--story-primary);
      color: var(--story-on-primary);
      border-color: var(--story-primary);
    }

    .btn-primary:hover {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      color: var(--story-on-primary);
    }

    .btn-ghost {
      background: var(--story-surface);
      color: var(--story-primary);
      border-color: var(--story-border-strong);
    }

    .btn-ghost:hover {
      border-color: var(--story-primary);
      color: var(--story-primary-hover);
    }

    .panel {
      padding: 1.35rem 1.5rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
    }

    .panel h2 {
      margin: 0 0 0.75rem;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--story-text);
    }

    .panel p {
      margin: 0 0 0.85rem;
      line-height: 1.6;
      color: var(--story-text-muted);
    }

    .panel p:last-child {
      margin-bottom: 0;
    }

    .panel code {
      font-size: 0.88em;
      padding: 0.12em 0.35em;
      background: #f1f5f9;
      border-radius: 4px;
      color: var(--story-text);
    }

    .features-heading {
      margin: 0 0 1rem;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--story-text);
    }

    .feature-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    }

    .feature-card {
      margin: 0;
      padding: 1.15rem 1.2rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .feature-card h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--story-text);
    }

    .feature-card p {
      margin: 0;
      flex: 1;
      font-size: 0.92rem;
      line-height: 1.55;
      color: var(--story-text-muted);
    }

    .feature-card strong {
      color: var(--story-text);
      font-weight: 600;
    }

    .feature-link {
      font-size: 0.9rem;
      font-weight: 600;
      margin-top: 0.25rem;
    }

    .cta-panel .cta-text {
      margin-bottom: 1rem;
    }

    .proposal .panel-lead {
      margin: 0 0 0.5rem;
      font-weight: 600;
      color: var(--story-text);
      font-size: 0.95rem;
    }

    .proposal-list {
      margin: 0 0 1rem;
      padding-left: 1.25rem;
      color: var(--story-text-muted);
      line-height: 1.55;
    }

    .proposal-list li {
      margin-bottom: 0.4rem;
    }
  `,
})
export class HomeComponent {}
