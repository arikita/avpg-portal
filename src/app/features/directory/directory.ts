import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DEPT_LABELS, EMERGENCY, MEETING_ROOMS } from '../../content/directory.content';
import { Contact, L } from '../../core/models/content.models';
import { AdContact, DirectoryService } from '../../core/services/directory.service';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { RouterLink } from '@angular/router';
import { fold } from '../../shared/util/fold';

/** One extension line - may be shared by several people. */
interface ExtRow {
  ext: string;
  /** Nhieu nguoi co the dung chung mot so; moi ten mot dong.
   *  username rong = phong hop / so khong gan voi tai khoan AD nao. */
  names: { name: string; username: string }[];
}
interface DirDept {
  name: L;
  floor?: L;
  icon: string;
  rows: ExtRow[];
  count: number;
}

const UNASSIGNED = '__none__';

@Component({
  selector: 'app-directory',
  imports: [TrPipe, IconComponent, RevealDirective, AvatarComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './directory.html',
})
export class Directory {
  /** So khan cap + phong hop khong nam trong AD nen van la du lieu tinh. */
  readonly emergency = EMERGENCY;
  readonly roomRows = this.group(MEETING_ROOMS);

  private readonly dir = inject(DirectoryService);
  private readonly content = inject(ContentService);
  private readonly langSvc = inject(LanguageService);
  readonly lang = this.langSvc.lang;
  readonly loading = this.dir.loading;
  readonly query = signal('');

  readonly totalPeople = computed(() => this.dir.data()?.total ?? 0);
  readonly deptCount = computed(() => this.dir.data()?.departments.length ?? 0);

  readonly departments = computed<DirDept[]>(() => {
    const data = this.dir.data();
    if (!data) return [];
    const q = fold(this.query().trim());
    const out: DirDept[] = [];
    for (const d of data.departments) {
      const label = this.deptLabel(d.name);
      const people = q
        ? d.contacts.filter((p) =>
            fold(p.name + ' ' + p.ext + ' ' + p.title + ' ' + p.username + ' ' + (label.vi ?? '') + ' ' + (label.en ?? ''))
              .includes(q),
          )
        : d.contacts;
      if (!people.length) continue;
      out.push({ name: label, icon: 'users', rows: this.group(people), count: people.length });
    }
    return out;
  });

  /** AD luu ten phong ban tieng Anh -> tra nhan song ngu tu DEPT_LABELS. */
  private deptLabel(name: string): L {
    if (name === UNASSIGNED) return { vi: 'Chưa phân loại', en: 'Unassigned' };
    const labels = this.content.pick('directory', 'DEPT_LABELS', DEPT_LABELS);
    return labels[name] ?? { vi: name, en: name };
  }

  /** Gop theo so may nhanh: mot so mot khoi, ben trong moi nguoi mot dong. */
  private group(contacts: (Contact | AdContact)[]): ExtRow[] {
    const map = new Map<string, { name: string; username: string }[]>();
    for (const c of contacts) {
      const ext = (c.ext ?? '').trim();
      const arr = map.get(ext) ?? [];
      arr.push({ name: c.name, username: (c as AdContact).username ?? '' });
      map.set(ext, arr);
    }
    return [...map.entries()]
      .map(([ext, names]) => ({ ext, names: names.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => {
        const na = parseInt(a.ext, 10);
        const nb = parseInt(b.ext, 10);
        if (isNaN(na) && isNaN(nb)) return 0;
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return na - nb;
      });
  }

  onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
}
