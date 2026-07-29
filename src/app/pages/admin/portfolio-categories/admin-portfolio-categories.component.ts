import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirebaseError } from 'firebase/app';
import { PortfolioService } from '../../../core/services/portfolio.service';
import {
  PORTFOLIO_ICON_OPTIONS,
  PortfolioCategory,
  PortfolioIcon,
} from '../../../core/models/portfolio.model';

@Component({
  selector: 'app-admin-portfolio-categories',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  templateUrl: './admin-portfolio-categories.component.html',
  styleUrl: './admin-portfolio-categories.component.scss',
})
export class AdminPortfolioCategoriesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly portfolio = inject(PortfolioService);

  readonly list$ = this.portfolio.getCategories();
  readonly iconOptions = PORTFOLIO_ICON_OPTIONS;
  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);
  coverFile: File | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    icon: ['rings' as PortfolioIcon, Validators.required],
  });

  startEdit(item: PortfolioCategory) {
    if (!item.id) return;
    this.editingId.set(item.id);
    this.coverFile = null;
    this.message.set('');
    this.error.set('');
    this.form.setValue({ title: item.title, icon: item.icon });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.coverFile = null;
    this.form.reset({ title: '', icon: 'rings' });
    this.message.set('');
    this.error.set('');
  }

  onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.coverFile = input.files?.[0] ?? null;
  }

  async seedDefaults() {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const created = await this.portfolio.seedDefaultCategories();
      this.message.set(
        created
          ? `${created} categoria(s) padrão criada(s).`
          : 'As categorias padrão já existem.'
      );
    } catch (err) {
      console.error(err);
      this.error.set(this.errMsg(err, 'criar categorias padrão'));
    } finally {
      this.loading.set(false);
    }
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    const { title, icon } = this.form.getRawValue();
    const id = this.editingId();
    try {
      if (id) {
        await this.portfolio.updateCategory(id, {
          title,
          icon,
          coverFile: this.coverFile,
        });
        this.cancelEdit();
        this.message.set('Categoria atualizada.');
      } else {
        await this.portfolio.createCategory({
          title,
          icon,
          coverFile: this.coverFile,
        });
        this.message.set('Categoria cadastrada.');
        this.form.reset({ title: '', icon: 'rings' });
        this.coverFile = null;
      }
    } catch (err) {
      console.error(err);
      this.error.set(this.errMsg(err, id ? 'atualizar' : 'cadastrar'));
    } finally {
      this.loading.set(false);
    }
  }

  async remove(item: PortfolioCategory) {
    if (!item.id) return;
    const ok = confirm(
      `Excluir a categoria "${item.title}"?\nTodas as fotos dela também serão removidas.`
    );
    if (!ok) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.portfolio.deleteCategory(item);
      if (this.editingId() === item.id) this.cancelEdit();
      this.message.set('Categoria excluída.');
    } catch (err) {
      console.error(err);
      this.error.set(this.errMsg(err, 'excluir'));
    } finally {
      this.loading.set(false);
    }
  }

  private errMsg(err: unknown, action: string) {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return 'Sem permissão. Publique as rules de portfolioCategories / portfolioPhotos e Storage portfolio/.';
    }
    return `Não foi possível ${action} a categoria.`;
  }
}
