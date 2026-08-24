import { Directive, ElementRef, HostListener, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Digitos como centavos: 1500 ? 15,00 (valor do control em reais). */
@Directive({
  selector: 'input[appCurrencyBrl]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyBrlInputDirective),
      multi: true,
    },
  ],
})
export class CurrencyBrlInputDirective implements ControlValueAccessor {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private onChange: (value: number) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: number | null | undefined): void {
    const reais = Number(value);
    const cents = Number.isFinite(reais) ? Math.round(reais * 100) : 0;
    this.el.nativeElement.value = formatCentsMask(cents);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.nativeElement.disabled = isDisabled;
  }

  @HostListener('input')
  onInput(): void {
    const digits = this.el.nativeElement.value.replace(/\D/g, '').slice(0, 11);
    const cents = digits ? Number.parseInt(digits, 10) : 0;
    this.el.nativeElement.value = formatCentsMask(cents);
    this.onChange(cents / 100);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  @HostListener('focus')
  onFocus(): void {
    const input = this.el.nativeElement;
    queueMicrotask(() => input.select());
  }
}

function formatCentsMask(cents: number): string {
  const safe = Number.isFinite(cents) && cents > 0 ? cents : 0;
  return (safe / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
