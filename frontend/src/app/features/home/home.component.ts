import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <section class="home">
      <h1>Bienvenido</h1>
      <p>
        Inventario (referencia tipo BOM / Sortly). El API corre en <code>http://localhost:8080</code>;
        en desarrollo, las peticiones a <code>/api</code> se reenvían desde el servidor de Angular (ver
        <code>proxy.conf.json</code>).
      </p>
    </section>
  `,
  styles: `
    .home {
      max-width: 40rem;
    }
    h1 {
      margin-top: 0;
      font-weight: 600;
    }
    code {
      font-size: 0.9em;
    }
  `,
})
export class HomeComponent {}
