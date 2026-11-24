import { useApp, type Lang, type Role } from '../store/useApp';
import type { ThemePref } from '../theme';
import { CITIES, STATES } from '../data/cities';
import { useT } from '../i18n/strings';
import { Brand, Field } from './ui';
import { backendLabel } from '../services/supabase';

export default function TopBar() {
  const T = useT();
  const { lang, role, city, mode, themePref, set } = useApp();
  return (
    <header className="surface relative z-30 flex flex-wrap items-end gap-4 px-5 py-3">
      <div className="flex items-center gap-3 self-center mr-2">
        <Brand />
        <div className="hidden xl:block text-[11px] text-muted max-w-[150px] leading-tight">{T.tagline}</div>
      </div>
      <Field label={T.city}>
        <select className="sel min-w-[220px]" value={city.id} onChange={(e) => set({ city: CITIES.find((c) => c.id === e.target.value)!, area: null, point: null, areaStatus: 'idle', mode: 'city', works: [] })}>
          {STATES.map((s) => (
            <optgroup key={s} label={s}>
              {CITIES.filter((c) => c.state === s).map((c) => <option key={c.id} value={c.id}>{lang === 'hi' ? c.hi : c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      {mode === 'study' && (
        <button onClick={() => set({ mode: 'city' })} className="self-end text-muted hover:text-ink underline-offset-4 hover:underline pb-2">← {T.backToCity}</button>
      )}
      <div className="flex-1" />
      <Field label={T.viewingAs}>
        <select className="sel" value={role} onChange={(e) => set({ role: e.target.value as Role })}>
          {Object.entries(T.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label={T.theme}>
        <select className="sel" value={themePref} onChange={(e) => set({ themePref: e.target.value as ThemePref })}>
          <option value="light">{T.themes.light}</option><option value="dark">{T.themes.dark}</option><option value="system">{T.themes.system}</option>
        </select>
      </Field>
      <Field label={T.language}>
        <select className="sel" value={lang} onChange={(e) => set({ lang: e.target.value as Lang })}>
          <option value="en">English</option><option value="hi">हिन्दी</option>
        </select>
      </Field>
      <span className="self-center text-[10px] px-2 py-1 rounded-full border border-line text-muted" title="Where proposals are saved">● {backendLabel}</span>
      <div className="rule-flow absolute left-0 right-0 bottom-0" />
    </header>
  );
}
