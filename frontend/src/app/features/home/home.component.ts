import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing">
      <section class="hero" aria-labelledby="landing-title">
        <div class="hero-copy">
          <span class="eyebrow">
            <span class="dot" aria-hidden="true"></span>
            Inventario, sin estrés
          </span>
          <h1 id="landing-title">
            Tu stock,<br />
            <span class="accent">en un solo sitio claro.</span>
          </h1>
          <p class="lede">
            Controla productos, carpetas y cada movimiento de stock con tu equipo.
          </p>
          <div class="hero-cta">
            <a routerLink="/register" class="btn-primary">
              Empezar — es gratis
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <a routerLink="/login" class="btn-ghost">Ya tengo cuenta</a>
          </div>
          <ul class="hero-trust">
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
              Sin tarjeta
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
              Acceso con Google
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
              Roles por equipo
            </li>
          </ul>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="mock">
            <div class="mock-header">
              <div class="mock-dots">
                <span></span><span></span><span></span>
              </div>
              <div class="mock-title">StoRy · Inventario</div>
            </div>

            <div class="mock-body">
              <div class="mock-kpis">
                <div class="kpi">
                  <span class="kpi-label">Productos</span>
                  <span class="kpi-value">248</span>
                  <span class="kpi-delta up">+12</span>
                </div>
                <div class="kpi">
                  <span class="kpi-label">Movim. (7d)</span>
                  <span class="kpi-value">1.4k</span>
                  <span class="kpi-delta up">+8%</span>
                </div>
                <div class="kpi">
                  <span class="kpi-label">Bajo stock</span>
                  <span class="kpi-value">6</span>
                  <span class="kpi-delta down">−3</span>
                </div>
              </div>

              <div class="mock-chart">
                <div class="bar" style="--h: 35%"></div>
                <div class="bar" style="--h: 55%"></div>
                <div class="bar" style="--h: 42%"></div>
                <div class="bar" style="--h: 78%"></div>
                <div class="bar" style="--h: 60%"></div>
                <div class="bar accent" style="--h: 92%"></div>
                <div class="bar" style="--h: 70%"></div>
              </div>

              <ul class="mock-list">
                <li>
                  <span class="dotg in"></span>
                  <span class="row-name">Caja A-204</span>
                  <span class="row-tag">+24</span>
                </li>
                <li>
                  <span class="dotg out"></span>
                  <span class="row-name">Cable USB-C</span>
                  <span class="row-tag">−6</span>
                </li>
                <li>
                  <span class="dotg in"></span>
                  <span class="row-name">Juego de destornilladores</span>
                  <span class="row-tag">+12</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="blob blob-1"></div>
          <div class="blob blob-2"></div>
        </div>
      </section>

      <section class="features" aria-labelledby="features-title">
        <h2 id="features-title" class="section-title">Todo lo que tu inventario necesita.</h2>

        <ul class="feature-grid">
          <li class="feature-card">
            <div class="feature-icon icon-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
              </svg>
            </div>
            <h3>Catálogo y carpetas</h3>
            <p>Organiza tus productos en un árbol de carpetas.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon icon-amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 17V9M12 17V5M17 17v-6M3 21h18" />
              </svg>
            </div>
            <h3>Movimientos al instante</h3>
            <p>Cada cambio de cantidad se registra como entrada, salida o ajuste, con el usuario que lo hizo.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon icon-green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Equipo y roles</h3>
            <p>Invita administradores, empleados y analistas. Cada rol ve justo lo que necesita.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon icon-violet" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 6-6" />
              </svg>
            </div>
            <h3>Estadísticas útiles</h3>
            <p>Totales, evolución diaria y productos más movidos, filtrados por fecha o categoría.</p>
          </li>
        </ul>
      </section>

      <section class="steps" aria-labelledby="steps-title">
        <h2 id="steps-title" class="section-title">De cero a controlado en 3 pasos.</h2>

        <ol class="step-list">
          <li class="step">
            <span class="step-num">1</span>
            <h3>Crea tu empresa</h3>
            <p>Regístrate y monta tu espacio de trabajo — elige tu moneda y dentro.</p>
          </li>
          <li class="step">
            <span class="step-num">2</span>
            <h3>Añade productos y carpetas</h3>
            <p>Estructura tu catálogo tal como está tu almacén en la vida real.</p>
          </li>
          <li class="step">
            <span class="step-num">3</span>
            <h3>Registra cada movimiento</h3>
            <p>Actualiza cantidades: StoRy lo apunta por ti y te enseña la tendencia.</p>
          </li>
        </ol>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .landing {
      max-width: 68rem;
      margin: 0 auto;
      padding: 0 1rem 3rem;
      display: flex;
      flex-direction: column;
      gap: 3.5rem;
    }

    /* ---------- HERO ---------- */
    .hero {
      position: relative;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      gap: 2.5rem;
      align-items: center;
      padding: 2.75rem 2rem;
      background:
        radial-gradient(1200px 400px at -10% -20%, rgba(59, 130, 246, 0.18), transparent 60%),
        radial-gradient(900px 360px at 110% 120%, rgba(245, 158, 11, 0.16), transparent 60%),
        linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid var(--story-border);
      border-radius: 24px;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }

    .hero-copy {
      position: relative;
      z-index: 1;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      margin-bottom: 1rem;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--story-primary);
      background: rgba(30, 64, 175, 0.08);
      border: 1px solid rgba(30, 64, 175, 0.18);
      border-radius: 999px;
    }

    .eyebrow .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--story-accent);
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
      animation: pulse 2.4s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35); }
      50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
    }

    .hero h1 {
      margin: 0 0 1rem;
      font-size: clamp(2.25rem, 4.5vw, 3.4rem);
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.05;
      color: #0f172a;
    }

    .hero h1 .accent {
      background: linear-gradient(90deg, var(--story-primary) 0%, var(--story-secondary) 60%, var(--story-accent) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .lede {
      margin: 0 0 1.5rem;
      font-size: 1.1rem;
      line-height: 1.6;
      color: #475569;
      max-width: 32rem;
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
      gap: 0.45rem;
      padding: 0.7rem 1.2rem;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .btn-primary {
      background: var(--story-primary);
      color: var(--story-on-primary);
      border-color: var(--story-primary);
      box-shadow: 0 6px 18px rgba(30, 64, 175, 0.28);
    }

    .btn-primary:hover {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      box-shadow: 0 8px 22px rgba(30, 64, 175, 0.34);
    }

    .btn-ghost {
      background: #ffffff;
      color: var(--story-primary);
      border-color: var(--story-border-strong);
    }

    .btn-ghost:hover {
      border-color: var(--story-primary);
      color: var(--story-primary-hover);
    }

    .btn-primary:focus-visible,
    .btn-ghost:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .hero-trust {
      list-style: none;
      margin: 1.5rem 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
    }

    .hero-trust li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      color: #475569;
    }

    .hero-trust svg {
      color: var(--story-success);
    }

    /* ---------- HERO VISUAL (mock dashboard) ---------- */
    .hero-visual {
      position: relative;
      min-height: 320px;
    }

    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(40px);
      opacity: 0.5;
      z-index: 0;
      pointer-events: none;
    }

    .blob-1 {
      width: 220px;
      height: 220px;
      background: rgba(59, 130, 246, 0.45);
      top: -40px;
      right: -30px;
    }

    .blob-2 {
      width: 180px;
      height: 180px;
      background: rgba(245, 158, 11, 0.4);
      bottom: -30px;
      left: 10px;
    }

    .mock {
      position: relative;
      z-index: 1;
      background: #ffffff;
      border: 1px solid var(--story-border);
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
      overflow: hidden;
      transform: rotate(-1deg);
      transition: transform 0.4s ease;
    }

    .hero:hover .mock {
      transform: rotate(0deg);
    }

    .mock-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.9rem;
      background: #f8fafc;
      border-bottom: 1px solid var(--story-border);
    }

    .mock-dots {
      display: flex;
      gap: 5px;
    }

    .mock-dots span {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #cbd5e1;
    }

    .mock-dots span:nth-child(1) { background: #ef4444; }
    .mock-dots span:nth-child(2) { background: #f59e0b; }
    .mock-dots span:nth-child(3) { background: #22c55e; }

    .mock-title {
      font-size: 0.78rem;
      color: #64748b;
      font-weight: 600;
    }

    .mock-body {
      padding: 1rem;
      display: grid;
      gap: 0.85rem;
    }

    .mock-kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
    }

    .kpi {
      background: #f8fafc;
      border: 1px solid var(--story-border);
      border-radius: 10px;
      padding: 0.55rem 0.7rem;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .kpi-label {
      font-size: 0.65rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }

    .kpi-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
    }

    .kpi-delta {
      font-size: 0.7rem;
      font-weight: 600;
    }

    .kpi-delta.up { color: var(--story-success); }
    .kpi-delta.down { color: var(--story-danger); }

    .mock-chart {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 80px;
      padding: 0.5rem 0.25rem 0;
      border-bottom: 1px dashed var(--story-border);
    }

    .bar {
      flex: 1;
      height: var(--h);
      background: linear-gradient(180deg, var(--story-secondary) 0%, var(--story-primary) 100%);
      border-radius: 4px 4px 2px 2px;
      opacity: 0.85;
      animation: grow 1.4s ease-out both;
      transform-origin: bottom;
    }

    .bar.accent {
      background: linear-gradient(180deg, #fbbf24 0%, var(--story-accent) 100%);
    }

    .bar:nth-child(1) { animation-delay: 0.05s; }
    .bar:nth-child(2) { animation-delay: 0.12s; }
    .bar:nth-child(3) { animation-delay: 0.19s; }
    .bar:nth-child(4) { animation-delay: 0.26s; }
    .bar:nth-child(5) { animation-delay: 0.33s; }
    .bar:nth-child(6) { animation-delay: 0.40s; }
    .bar:nth-child(7) { animation-delay: 0.47s; }

    @keyframes grow {
      from { transform: scaleY(0); opacity: 0; }
      to { transform: scaleY(1); opacity: 0.85; }
    }

    .mock-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
    }

    .mock-list li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.45rem 0.6rem;
      background: #ffffff;
      border: 1px solid var(--story-border);
      border-radius: 8px;
      font-size: 0.82rem;
    }

    .dotg {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dotg.in { background: var(--story-success); }
    .dotg.out { background: var(--story-danger); }

    .row-name {
      color: #1e293b;
      font-weight: 500;
    }

    .row-tag {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #64748b;
    }

    .mock-list li:nth-child(1) .row-tag { color: var(--story-success); }
    .mock-list li:nth-child(2) .row-tag { color: var(--story-danger); }
    .mock-list li:nth-child(3) .row-tag { color: var(--story-success); }

    /* ---------- SECTIONS ---------- */
    .section-title {
      margin: 0 0 1.5rem;
      font-size: clamp(1.4rem, 2.4vw, 1.9rem);
      font-weight: 700;
      letter-spacing: -0.015em;
      color: #0f172a;
      text-align: center;
    }

    .section-title span {
      color: #64748b;
      font-weight: 600;
    }

    /* ---------- FEATURES ---------- */
    .feature-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    }

    .feature-card {
      margin: 0;
      padding: 1.4rem 1.3rem;
      background: #ffffff;
      border: 1px solid var(--story-border);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }

    .feature-card:hover {
      border-color: var(--story-border-strong);
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.07);
      transform: translateY(-2px);
    }

    .feature-icon {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-blue   { background: rgba(30, 64, 175, 0.10);  color: var(--story-primary); }
    .icon-amber  { background: rgba(245, 158, 11, 0.14); color: var(--story-accent-muted); }
    .icon-green  { background: rgba(21, 128, 61, 0.10);  color: var(--story-success); }
    .icon-violet { background: rgba(139, 92, 246, 0.12); color: #7c3aed; }

    .feature-card h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: #0f172a;
    }

    .feature-card p {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.55;
      color: #475569;
    }

    /* ---------- STEPS ---------- */
    .step-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      counter-reset: step;
    }

    .step {
      position: relative;
      padding: 1.5rem 1.3rem 1.3rem;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid var(--story-border);
      border-radius: 14px;
    }

    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--story-primary);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
    }

    .step h3 {
      margin: 0 0 0.35rem;
      font-size: 1.05rem;
      font-weight: 600;
      color: #0f172a;
    }

    .step p {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.55;
      color: #475569;
    }

    /* ---------- RESPONSIVE ---------- */
    @media (max-width: 860px) {
      .hero {
        grid-template-columns: 1fr;
        padding: 2rem 1.25rem;
        gap: 1.75rem;
      }

      .hero-visual {
        min-height: 0;
      }

      .mock {
        transform: rotate(0deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .eyebrow .dot,
      .bar,
      .mock {
        animation: none !important;
        transition: none !important;
      }
    }
  `,
})
export class HomeComponent {}
