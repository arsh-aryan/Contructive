import { useApp, type Lang, type Role } from '../store/useApp';
import { CITIES, STATES } from '../data/cities';
import { useT } from '../i18n/strings';
import { Field, LottieIcon } from './ui';
import { loaderAnim } from '../anim/anims';
import { backendLabel } from '../services/supabase';
import { useMemo } from 'react';

export default function TopBar() {
  const T = useT();
  const { lang, role, city, mode, set } = useApp();
  const logo = useMemo(() => loaderAnim(), []);
  return (
    <header className="relative z-30 flex flex-wrap items-end gap-4 px-5 py-3 border-b border-line bg-panel/90 backdrop-blur">
      <div className="flex items-center gap-2.5 self-center mr-2">
        <LottieIcon data={logo} className="w-8 h-8" />
        <div><div className="display text-[20px]">Constructive</div><div className="text-[11px] text-muted">{T.tagline}</div></div>
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
      <Field label={T.language}>
        <select className="sel" value={lang} onChange={(e) => set({ lang: e.target.value as Lang })}>
          <option value="en">English</option><option value="hi">हिन्दी</option>
        </select>
      </Field>
      <span className="self-center text-[10px] px-2 py-1 rounded-full border border-line text-muted" title="Where proposals are saved">● {backendLabel}</span>
    </header>
  );
}
