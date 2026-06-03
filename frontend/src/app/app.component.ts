import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { canViewEstadisticas } from './core/utils/company-role.util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly title = 'StoRy';
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly userMenuOpen = signal(false);
  private readonly userMenuRoot = viewChild<ElementRef<HTMLElement>>('userMenuRoot');

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const root = this.userMenuRoot()?.nativeElement;
    if (!root || !(event.target instanceof Node)) return;
    if (root.contains(event.target)) return;
    if (this.userMenuOpen()) this.userMenuOpen.set(false);
  }

  protected toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected logout(): void {
    this.closeUserMenu();
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  /** Texto junto al avatar: nombre preferente, si no el usuario de sesión. */
  protected userDisplayName(): string {
    const u = this.auth.currentUser();
    if (!u) {
      return 'Usuario';
    }
    const n = u.name?.trim();
    return n || u.username || 'Usuario';
  }

  /** Estadísticas de inventario: administrador de empresa o analytics_viewer (alineado con la API). */
  protected puedeVerEstadisticas(): boolean {
    return canViewEstadisticas(this.auth.currentUser()?.companyRole);
  }
}
