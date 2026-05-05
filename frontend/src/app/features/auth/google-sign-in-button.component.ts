import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-google-sign-in-button',
  standalone: true,
  template: `<div #host class="google-host"></div>`,
  styles: `
    .google-host {
      display: flex;
      justify-content: center;
    }
  `,
})
export class GoogleSignInButtonComponent implements AfterViewInit {
  readonly clientId = input.required<string>();
  readonly signedIn = output<string>();

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');

  ngAfterViewInit(): void {
    this.tryInitGoogle(0);
  }

  private tryInitGoogle(attempt: number): void {
    const cid = this.clientId();
    if (!cid || attempt > 50) {
      return;
    }
    const el = this.host()?.nativeElement;
    if (el && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: cid,
        callback: (res: { credential: string }) => this.signedIn.emit(res.credential),
      });
      window.google.accounts.id.renderButton(el, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
      });
      return;
    }
    globalThis.setTimeout(() => this.tryInitGoogle(attempt + 1), 100);
  }
}
