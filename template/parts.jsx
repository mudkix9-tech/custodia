// Reusable parts for the Custodia dashboard.
// All components register on window at the bottom.

const { useEffect, useMemo, useRef, useState } = React;
const RC = window.Recharts || {};

// ---------- Sidebar ----------
function Logo({ className = '' }) {
  // Original Custodia mark: rounded square with an inset "shield-petal" cut.
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#3F5836" />
        <path
          d="M16 7c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8z"
          fill="#EFF2EC"
        />
        <circle cx="16" cy="15" r="2.2" fill="#3F5836" />
      </svg>
      <div className="leading-none">
        <div className="font-serif text-[22px] tracking-tight text-ink-900">Custodia</div>
      </div>
    </div>
  );
}

function Sidebar({ active, onNav }) {
  return (
    <aside className="w-[244px] shrink-0 hidden lg:flex flex-col border-r border-ink-900/8 bg-bone-50 sticky top-0 h-screen">
      <div className="px-5 pt-6 pb-4">
        <Logo />
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="px-2 pt-2 pb-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-400">Workspace</div>
        <ul className="space-y-0.5">
          {NAV.map((n) => {
            const isActive = active === n.id;
            return (
              <li key={n.id}>
                <button
                  onClick={() => onNav(n.id)}
                  className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-colors
                    ${isActive
                      ? 'bg-sage-50 text-sage-700 font-medium'
                      : 'text-ink-700 hover:bg-bone-100'}`}
                >
                  <Icon
                    name={n.icon}
                    size={16}
                    className={isActive ? 'text-sage-600' : 'text-ink-500 group-hover:text-ink-700'}
                  />
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.id === 'dsars' && (
                    <span className="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-md bg-clay-50 text-clay-600">1</span>
                  )}
                  {n.id === 'vendors' && (
                    <span className="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600">4</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-2 px-3 pb-3 pt-3 border-t border-ink-900/8">
        <ul className="space-y-0.5 mb-3">
          <li>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-ink-700 hover:bg-bone-100">
              <Icon name="Settings" size={16} className="text-ink-500" /> Settings
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-ink-700 hover:bg-bone-100">
              <Icon name="LifeBuoy" size={16} className="text-ink-500" /> Help &amp; Docs
            </button>
          </li>
        </ul>
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-bone-100 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center font-medium text-[12.5px]">SK</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] text-ink-900 truncate">Sarah Kowalski</div>
            <div className="text-[11.5px] text-ink-500 truncate">Operations Lead</div>
          </div>
          <Icon name="ChevronUp" size={14} className="text-ink-400" />
        </div>
      </div>
    </aside>
  );
}

// ---------- Header ----------
function OrgHeader({ now }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
      <div className="min-w-0">
        <div className="text-[12.5px] text-ink-500 mb-1.5 flex items-center gap-1.5">
          <Icon name="Sun" size={13} /> {now}
        </div>
        <h1 className="font-serif text-[40px] md:text-[44px] leading-[1.05] tracking-tight text-ink-900">
          Welcome back, Sarah.
        </h1>
        <div className="mt-2 flex items-center gap-2 text-[13.5px] text-ink-600">
          <span className="font-medium text-ink-800">Acme Digital Agency</span>
          <span className="text-ink-300">/</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sage-50 text-sage-700 text-[11.5px] font-medium tracking-wide">
            <Icon name="Sparkles" size={11} /> Professional
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bone-100 hairline text-ink-800 text-[13px] hover:bg-bone-200">
          <Icon name="UserPlus" size={14} /> Invite team member
        </button>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bone-100 hairline text-ink-800 text-[13px] hover:bg-bone-200">
          <Icon name="Download" size={14} /> Export audit file
        </button>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sage-700 text-bone-50 text-[13px] hover:bg-sage-600 shadow-card">
          <Icon name="Gauge" size={14} /> Run assessment
        </button>
      </div>
    </div>
  );
}

// ---------- Compliance ring (animated 0 -> value) ----------
function ComplianceRing({ value = 72, size = 200, stroke = 14 }) {
  const [v, setV] = useState(0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (v / 100);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 1400;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round(value * easeOut(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const status =
    v >= 80 ? { label: 'Strong',     tone: 'sage' } :
    v >= 60 ? { label: 'Good',       tone: 'sage' } :
    v >= 40 ? { label: 'Needs work', tone: 'amber' } :
              { label: 'At risk',    tone: 'clay' };

  const ringColor =
    status.tone === 'sage' ? '#557448' :
    status.tone === 'amber' ? '#C68A2A' : '#C25A38';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="#EDE6D7" strokeWidth={stroke} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke={ringColor} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-serif text-[56px] leading-none tracking-tight text-ink-900 tabular-nums">
          {v}<span className="text-[28px] text-ink-500">%</span>
        </div>
        <div className={`mt-1 text-[12px] font-medium tracking-wide uppercase
          ${status.tone === 'sage' ? 'text-sage-700' : status.tone === 'amber' ? 'text-amber-600' : 'text-clay-600'}`}>
          {status.label}
        </div>
      </div>
    </div>
  );
}

function SubscoreBar({ label, value }) {
  const tone =
    value >= 80 ? 'bg-sage-500' :
    value >= 60 ? 'bg-sage-300' :
    value >= 40 ? 'bg-amber-500' : 'bg-clay-500';
  return (
    <div className="group">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-[12.5px] text-ink-700">{label}</div>
        <div className="text-[12.5px] tabular-nums font-medium text-ink-900">{value}%</div>
      </div>
      <div className="h-1.5 rounded-full bg-bone-200 overflow-hidden">
        <div
          className={`h-full ${tone} rounded-full transition-[width] duration-[1100ms] ease-out`}
          style={{ width: `${value}%`, transitionDelay: '300ms' }}
        />
      </div>
    </div>
  );
}

function ScoreHero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <section className="bg-bone-50 hairline rounded-2xl p-6 md:p-8 mb-7 fade-up">
      <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-start">
        <div className="flex flex-col items-center md:items-start shrink-0">
          <div className="text-[11.5px] uppercase tracking-[0.14em] text-ink-500 mb-3">Overall compliance</div>
          <ComplianceRing value={mounted ? 72 : 0} />
          <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-sage-700 bg-sage-50 px-2 py-1 rounded-md">
            <Icon name="TrendingUp" size={13} /> Up 12 points from last month
          </div>
        </div>

        <div className="flex-1 w-full">
          <div className="flex items-baseline justify-between mb-4">
            <div className="text-[13px] text-ink-700 font-medium">Category scores</div>
            <div className="text-[12px] text-ink-500">6 areas tracked</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {SUBSCORES.map((s) => (
              <SubscoreBar key={s.label} {...s} />
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-ink-900/8 flex flex-wrap gap-x-8 gap-y-2 text-[12.5px] text-ink-600">
            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-sage-500"/> 80%+ strong</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-sage-300"/> 60–79 good</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/> 40–59 needs work</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-clay-500"/> below 40 at risk</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Urgent items ----------
function SeverityChip({ severity }) {
  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-clay-50 text-clay-600 text-[10.5px] font-medium uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-clay-500" /> Critical
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10.5px] font-medium uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning
    </span>
  );
}

function UrgentList({ items, onResolve }) {
  if (!items.length) {
    return (
      <div className="bg-bone-50 hairline rounded-2xl p-7 flex items-center gap-4 fade-up">
        <div className="w-12 h-12 rounded-full bg-sage-50 flex items-center justify-center text-sage-700">
          <Icon name="Check" size={22} />
        </div>
        <div>
          <div className="font-medium text-ink-900">You\u2019re all caught up.</div>
          <div className="text-[13px] text-ink-600 mt-0.5">No urgent action items right now. Nicely done.</div>
        </div>
      </div>
    );
  }
  return (
    <section className="bg-bone-50 hairline rounded-2xl overflow-hidden fade-up">
      <header className="px-5 py-4 flex items-center justify-between border-b border-ink-900/8">
        <div className="flex items-center gap-2">
          <Icon name="AlertCircle" size={16} className="text-clay-600" />
          <h2 className="text-[14px] font-medium text-ink-900">Needs your attention</h2>
          <span className="text-[12px] text-ink-500">{items.length} items</span>
        </div>
        <button className="text-[12.5px] text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
          View all <Icon name="ArrowRight" size={12} />
        </button>
      </header>
      <ul>
        {items.map((it, i) => (
          <li
            key={i}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-bone-100 transition-colors
              ${i !== items.length - 1 ? 'border-b border-ink-900/6' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
              ${it.severity === 'critical' ? 'bg-clay-50 text-clay-600' : 'bg-amber-50 text-amber-600'}`}>
              <Icon name={it.icon} size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityChip severity={it.severity} />
                <span className="text-[10.5px] uppercase tracking-wide text-ink-400">{it.module}</span>
              </div>
              <div className="text-[13.5px] text-ink-900 mt-0.5 truncate">{it.title}</div>
              <div className="text-[12.5px] text-ink-500">{it.meta}</div>
            </div>
            <button
              onClick={() => onResolve(i)}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-bone-100 hairline text-[12.5px] text-ink-800 hover:bg-bone-200 shrink-0"
            >
              {it.cta} <Icon name="ArrowRight" size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Module cards ----------
function MiniSpark({ data, color = '#557448', height = 28 }) {
  if (!data) return null;
  const w = 100;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (x) => ((x - xMin) / (xMax - xMin || 1)) * w;
  const sy = (y) => height - ((y - yMin) / (yMax - yMin || 1)) * (height - 2) - 1;
  const d = data.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
  const area = `${d} L${sx(xMax)},${height} L${sx(xMin)},${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={area} fill={color} fillOpacity="0.10" />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CountdownPill({ day, total }) {
  const pct = (day / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10 shrink-0">
        <svg viewBox="0 0 36 36" className="-rotate-90 w-10 h-10">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#F4E0B6" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15" fill="none" stroke="#C68A2A" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(pct/100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] tabular-nums font-medium text-amber-600">
          {day}
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-[12px] text-ink-700 font-medium">Day {day} / {total}</div>
        <div className="text-[11.5px] text-ink-500">{total - day} days left</div>
      </div>
    </div>
  );
}

function ModuleCard({ m, onOpen }) {
  const isPositive = m.positive;
  return (
    <button
      onClick={() => onOpen(m.id)}
      className="text-left group bg-bone-50 hairline rounded-xl p-4 hover:shadow-lift hover:-translate-y-px transition-all duration-200 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
          ${isPositive ? 'bg-sage-50 text-sage-700' : 'bg-bone-100 text-ink-700'}`}>
          <Icon name={m.icon} size={15} />
        </div>
        <Icon name="ArrowUpRight" size={14} className="text-ink-300 group-hover:text-ink-700 transition-colors" />
      </div>
      <div className="text-[12.5px] text-ink-500 mb-1">{m.title}</div>
      <div className="flex items-baseline gap-1.5">
        <div className={`font-serif tracking-tight text-[28px] leading-none
          ${isPositive ? 'text-sage-700' : 'text-ink-900'}`}>{m.primary}</div>
        <div className="text-[12px] text-ink-500">{m.primarySuffix}</div>
      </div>
      <div className="text-[12.5px] text-ink-600 mt-1.5 line-clamp-1">{m.detail}</div>

      <div className="mt-3 pt-3 border-t border-ink-900/8 min-h-[36px] flex items-center">
        {m.spark && <div className="w-full"><MiniSpark data={m.spark} /></div>}
        {m.countdown && <CountdownPill {...m.countdown} />}
        {m.progress != null && (
          <div className="w-full">
            <div className="flex items-center justify-between text-[11.5px] text-ink-500 mb-1">
              <span>Completion</span><span className="tabular-nums">{m.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-bone-200 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${m.progress}%` }} />
            </div>
          </div>
        )}
        {m.cta && (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-sage-700 group-hover:text-sage-600">
            <Icon name="RefreshCw" size={12} /> {m.cta}
          </span>
        )}
        {m.foot && !m.spark && !m.countdown && m.progress == null && !m.cta && (
          <div className="flex items-baseline justify-between w-full">
            <span className="text-[11.5px] text-ink-500">{m.foot.label}</span>
            <span className={`text-[12.5px] font-medium tabular-nums
              ${m.foot.tone === 'good' ? 'text-sage-700' : m.foot.tone === 'warn' ? 'text-amber-600' : 'text-ink-900'}`}>
              {m.foot.value}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function ModuleGrid({ onOpen }) {
  return (
    <section className="fade-up">
      <SectionHead title="Modules" hint="Tap any card to manage" icon="Grid3x3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {MODULES.map((m) => (
          <ModuleCard key={m.id} m={m} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

// ---------- Section header ----------
function SectionHead({ title, hint, icon, action }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <div className="flex items-center gap-2">
        {icon && <Icon name={icon} size={15} className="text-ink-500" />}
        <h2 className="text-[14px] font-medium text-ink-900">{title}</h2>
        {hint && <span className="text-[12px] text-ink-500">{hint}</span>}
      </div>
      {action}
    </div>
  );
}

// ---------- Trend chart (Recharts) ----------
function TrendChart() {
  const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } = RC;
  if (!ResponsiveContainer) {
    return <div className="h-[240px] bg-bone-100 rounded-xl animate-pulse" />;
  }
  return (
    <section className="bg-bone-50 hairline rounded-2xl p-5 md:p-6 fade-up">
      <SectionHead
        title="Compliance trend"
        hint="Last 6 months"
        icon="LineChart"
        action={
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sage-600"/> Score</span>
          </div>
        }
      />
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TREND} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="sageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#6B8A5A" stopOpacity={0.28}/>
                <stop offset="100%" stopColor="#6B8A5A" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EDE6D7" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="month" stroke="#9B9080" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis stroke="#9B9080" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[40, 100]} ticks={[40, 60, 80, 100]} />
            <Tooltip
              contentStyle={{
                background: '#FBF8F3',
                border: '1px solid rgba(31,27,22,0.12)',
                borderRadius: 8,
                fontSize: 12,
                color: '#1F1B16',
              }}
              labelStyle={{ color: '#5A5247' }}
              formatter={(v) => [`${v}%`, 'Score']}
            />
            <ReferenceLine y={70} stroke="#A9B89A" strokeDasharray="3 3" label={{ value: 'Target 70', position: 'right', fill: '#7A7062', fontSize: 11 }} />
            <Area type="monotone" dataKey="score" stroke="#557448" strokeWidth={2} fill="url(#sageFill)" dot={{ r: 3, fill: '#557448', stroke: '#FBF8F3', strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ---------- Activity feed ----------
function ActivityFeed() {
  return (
    <section className="bg-bone-50 hairline rounded-2xl p-5 md:p-6 fade-up">
      <SectionHead title="Recent activity" hint="Across the org" icon="Activity" />
      <ol className="relative">
        <span className="absolute left-[15px] top-2 bottom-2 w-px bg-ink-900/8" aria-hidden="true" />
        {ACTIVITY.map((a, i) => (
          <li key={i} className="relative flex gap-3 py-2.5">
            <div className="relative w-8 h-8 rounded-full bg-bone-100 hairline flex items-center justify-center text-ink-700 shrink-0 z-10">
              <Icon name={a.icon} size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-ink-800">
                <span className="font-medium text-ink-900">{a.who}</span>{' '}
                <span className="text-ink-700">{a.text}</span>
              </div>
              <div className="text-[11.5px] text-ink-500 mt-0.5">{a.when}</div>
            </div>
          </li>
        ))}
      </ol>
      <a href="#" className="inline-flex items-center gap-1 mt-3 text-[13px] text-sage-700 hover:text-sage-600">
        View full activity log <Icon name="ArrowRight" size={12} />
      </a>
    </section>
  );
}

// ---------- Client overview ----------
function ClientTable() {
  return (
    <section className="bg-bone-50 hairline rounded-2xl p-5 md:p-6 fade-up">
      <SectionHead
        title="Client compliance"
        hint={`${CLIENTS.length} clients`}
        icon="Users"
        action={<a href="#" className="text-[13px] text-sage-700 hover:text-sage-600 inline-flex items-center gap-1">Manage clients <Icon name="ArrowRight" size={12} /></a>}
      />
      <div className="overflow-x-auto -mx-2">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-400">
              <th className="px-2 py-2 font-normal">Client</th>
              <th className="px-2 py-2 font-normal">Activities</th>
              <th className="px-2 py-2 font-normal">DPA</th>
              <th className="px-2 py-2 font-normal">Last report</th>
              <th className="px-2 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map((c) => (
              <tr key={c.name} className="border-t border-ink-900/6 hover:bg-bone-100/60">
                <td className="px-2 py-3 text-ink-900 font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-md bg-bone-200 text-ink-700 inline-flex items-center justify-center text-[11px] font-medium">
                      {c.name.split(' ').map(w => w[0]).join('').slice(0,2)}
                    </span>
                    {c.name}
                  </div>
                </td>
                <td className="px-2 py-3 text-ink-700 tabular-nums">{c.activities}</td>
                <td className="px-2 py-3">
                  {c.dpa === 'signed' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sage-50 text-sage-700 text-[11.5px]">
                      <Icon name="Check" size={11} /> Signed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[11.5px]">
                      <Icon name="Clock" size={11} /> Pending
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-ink-700">{c.lastReport}</td>
                <td className="px-2 py-3 text-right">
                  <button className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 text-[12.5px]">
                    Open <Icon name="ArrowRight" size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Footer ----------
function Footer() {
  return (
    <footer className="mt-10 pt-6 border-t border-ink-900/8 text-[12px] text-ink-500 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-sage-500"/> Custodia v1.0</span>
        <span className="text-ink-300">·</span>
        <span>© 2026 Custodia</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5"><Icon name="Server" size={12}/> EU hosted (Frankfurt)</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="Lock" size={12}/> AES-256 encrypted</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="ShieldCheck" size={12}/> GDPR compliant</span>
      </div>
      <div className="flex items-center gap-4">
        <a href="#" className="hover:text-ink-900">Help</a>
        <a href="#" className="hover:text-ink-900">Status</a>
        <a href="#" className="hover:text-ink-900">Contact DPO</a>
      </div>
    </footer>
  );
}

// ---------- Topbar (mobile) ----------
function TopBar({ onMenu }) {
  return (
    <div className="lg:hidden sticky top-0 z-20 bg-bone-50/90 backdrop-blur border-b border-ink-900/8 px-4 py-3 flex items-center justify-between">
      <Logo />
      <button onClick={onMenu} className="p-2 rounded-md hover:bg-bone-100">
        <Icon name="Menu" size={18} />
      </button>
    </div>
  );
}

Object.assign(window, {
  Sidebar, OrgHeader, ScoreHero, UrgentList, ModuleGrid, TrendChart,
  ActivityFeed, ClientTable, Footer, TopBar, Logo,
});
