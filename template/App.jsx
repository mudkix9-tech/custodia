// Custodia dashboard - root composition
// (useState/useEffect/useMemo already destructured in parts.jsx)

function App() {
  const [active, setActive] = useState('dashboard');
  const [urgent, setUrgent] = useState(URGENT);
  const [toast, setToast] = useState(null);

  const greetingDate = useMemo(() => {
    const d = new Date(2026, 3, 28); // Apr 28 2026 - keep deterministic for sample
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleResolve = (idx) => {
    const item = urgent[idx];
    setUrgent((u) => u.filter((_, i) => i !== idx));
    showToast(`${item.cta} \u2192 ${item.title}`);
  };

  const handleOpen = (id) => {
    showToast(`Opening ${id.toUpperCase()}\u2026`);
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar active={active} onNav={setActive} />

      <div className="flex-1 min-w-0">
        <TopBar onMenu={() => {}} />

        <main className="px-5 md:px-8 lg:px-10 py-7 md:py-9 max-w-[1480px] mx-auto">
          <OrgHeader now={greetingDate} />
          <ScoreHero />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-7">
            <div className="xl:col-span-2">
              <SectionHead title="Needs your attention" hint={`${urgent.length} open`} icon="AlertCircle" />
              <UrgentList items={urgent} onResolve={handleResolve} />
            </div>
            <div>
              <SectionHead title="Today" hint="Snapshot" icon="CalendarDays" />
              <TodayCard urgent={urgent} />
            </div>
          </div>

          <div className="mb-7">
            <ModuleGrid onOpen={handleOpen} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-7">
            <div className="xl:col-span-2">
              <TrendChart />
            </div>
            <div>
              <ActivityFeed />
            </div>
          </div>

          <ClientTable />
          <Footer />
        </main>
      </div>

      {/* Toast */}
      <div
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-ink-900 text-bone-50 text-[13px] shadow-lift
          transition-all duration-300
          ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="Check" size={14} className="text-sage-300" />
          {toast || ''}
        </span>
      </div>
    </div>
  );
}

// Today card — quick snapshot column to balance the urgent list visually
function TodayCard({ urgent }) {
  const critical = urgent.filter((u) => u.severity === 'critical').length;
  const warning  = urgent.filter((u) => u.severity === 'warning').length;
  return (
    <div className="bg-bone-50 hairline rounded-2xl p-5 md:p-6 fade-up h-full">
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-[28px] leading-none tracking-tight text-ink-900">Tuesday</div>
        <div className="text-[12px] text-ink-500">28 April</div>
      </div>
      <div className="mt-1 text-[12.5px] text-ink-500 italic font-serif">A calm morning. A few things to look at.</div>

      <ul className="mt-5 space-y-3">
        <li className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-clay-50 text-clay-600 flex items-center justify-center"><Icon name="AlertCircle" size={15}/></div>
          <div className="flex-1">
            <div className="text-[13px] text-ink-900">{critical} critical {critical === 1 ? 'item' : 'items'}</div>
            <div className="text-[11.5px] text-ink-500">Resolve within 72 hours</div>
          </div>
          <span className="font-serif text-[22px] tabular-nums text-clay-600">{critical}</span>
        </li>
        <li className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Icon name="Clock" size={15}/></div>
          <div className="flex-1">
            <div className="text-[13px] text-ink-900">{warning} warnings</div>
            <div className="text-[11.5px] text-ink-500">Schedule for this week</div>
          </div>
          <span className="font-serif text-[22px] tabular-nums text-amber-600">{warning}</span>
        </li>
        <li className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sage-50 text-sage-700 flex items-center justify-center"><Icon name="CalendarCheck" size={15}/></div>
          <div className="flex-1">
            <div className="text-[13px] text-ink-900">DPIA review</div>
            <div className="text-[11.5px] text-ink-500">Due Jun 15 — 7 weeks out</div>
          </div>
          <span className="text-[12px] text-sage-700 font-medium">On track</span>
        </li>
      </ul>

      <div className="mt-5 pt-4 border-t border-ink-900/8 flex items-center justify-between">
        <div>
          <div className="text-[11.5px] uppercase tracking-[0.12em] text-ink-400">Audit readiness</div>
          <div className="text-[15px] text-ink-900 font-medium mt-0.5">Ready to ship</div>
        </div>
        <button className="text-[12.5px] text-sage-700 hover:text-sage-600 inline-flex items-center gap-1">
          Generate file <Icon name="ArrowRight" size={12} />
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
