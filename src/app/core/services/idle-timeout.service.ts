import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

const IDLE_MS = 60 * 60 * 1000;
const CHECK_MS = 30 * 1000;
const ACTIVITY_THROTTLE_MS = 15 * 1000;
const STORAGE_KEY = 'nox-last-activity';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private loggingOut = false;
  private lastStoredAt = 0;
  private readonly onActivity = () => this.markActivity();
  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) this.enforceIdle();
  };
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') this.enforceIdle();
  };

  constructor() {
    this.auth.firebaseUser$.subscribe((user) => {
      if (user) this.start();
      else this.stop();
    });
  }

  private start() {
    this.markActivity(true);
    this.bind();
    if (this.checkTimer) return;
    this.checkTimer = setInterval(() => this.enforceIdle(), CHECK_MS);
  }

  private stop() {
    this.unbind();
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.loggingOut = false;
  }

  private bind() {
    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, this.onActivity, { passive: true })
    );
    window.addEventListener('storage', this.onStorage);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  private unbind() {
    ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, this.onActivity));
    window.removeEventListener('storage', this.onStorage);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private markActivity(force = false) {
    const now = Date.now();
    if (!force && now - this.lastStoredAt < ACTIVITY_THROTTLE_MS) return;
    this.lastStoredAt = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // storage bloqueado
    }
  }

  private lastActivity(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return this.lastStoredAt;
    }
  }

  private async enforceIdle() {
    if (this.loggingOut) return;
    const last = this.lastActivity();
    if (!last || Date.now() - last < IDLE_MS) return;

    this.loggingOut = true;
    try {
      await this.auth.logout();
      await this.router.navigate(['/login'], { queryParams: { idle: '1' } });
    } catch {
      this.loggingOut = false;
    }
  }
}
