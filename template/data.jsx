// All hardcoded sample data for the Privaro dashboard.

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',       icon: 'LayoutDashboard' },
  { id: 'ropa',       label: 'ROPA',            icon: 'Map' },
  { id: 'vendors',    label: 'Vendors',         icon: 'Building2' },
  { id: 'policies',   label: 'Privacy Policies',icon: 'FileText' },
  { id: 'cookies',    label: 'Cookie Consent',  icon: 'Cookie' },
  { id: 'dsars',      label: 'DSARs',           icon: 'UserCog' },
  { id: 'breaches',   label: 'Breaches',        icon: 'ShieldAlert' },
  { id: 'dpias',      label: 'DPIAs',           icon: 'ClipboardCheck' },
  { id: 'training',   label: 'Training',        icon: 'GraduationCap' },
  { id: 'assessments',label: 'Assessments',     icon: 'Gauge' },
  { id: 'audit',      label: 'Audit Files',     icon: 'FolderArchive' },
];

const SUBSCORES = [
  { label: 'Data Mapping',         value: 82 },
  { label: 'Lawful Basis',         value: 71 },
  { label: 'Vendor Compliance',    value: 54 },
  { label: 'Data Subject Rights',  value: 88 },
  { label: 'Security Measures',    value: 76 },
  { label: 'Training',             value: 45 },
];

const URGENT = [
  {
    severity: 'critical',
    icon: 'UserCog',
    title: 'DSAR from john@example.com',
    meta: '3 days remaining of 30',
    cta: 'Respond',
    module: 'DSARs',
  },
  {
    severity: 'critical',
    icon: 'Building2',
    title: 'Mailchimp DPA expired',
    meta: 'Expired 5 days ago',
    cta: 'Renew',
    module: 'Vendors',
  },
  {
    severity: 'warning',
    icon: 'Map',
    title: 'Quarterly ROPA review overdue',
    meta: '3 activities pending review',
    cta: 'Review',
    module: 'ROPA',
  },
  {
    severity: 'warning',
    icon: 'GraduationCap',
    title: '2 team members haven\u2019t completed training',
    meta: 'Due within 14 days',
    cta: 'Remind',
    module: 'Training',
  },
  {
    severity: 'warning',
    icon: 'Cookie',
    title: '2 unclassified cookies detected on acme.com',
    meta: 'Detected by last scan',
    cta: 'Classify',
    module: 'Cookie Consent',
  },
];

// Tiny helper: deterministic-ish values for sparklines
function spark(seed, n = 14, base = 60, amp = 30) {
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += Math.sin((i + seed) * 1.3) * (amp / 6) + Math.cos((i * 0.7) + seed) * (amp / 8);
    out.push({ x: i, y: Math.max(0, v) });
  }
  return out;
}

const COOKIE_SPARK = [
  410, 432, 408, 451, 470, 489, 462, 503, 521, 498, 533, 560, 547, 581,
].map((y, x) => ({ x, y }));

const MODULES = [
  {
    id: 'ropa',
    title: 'ROPA',
    icon: 'Map',
    primary: '24',
    primarySuffix: 'activities',
    detail: '18 complete \u00b7 4 drafts \u00b7 2 need review',
    foot: { label: 'Avg. completeness', value: '86%' },
    accent: 'sage',
  },
  {
    id: 'vendors',
    title: 'Vendors',
    icon: 'Building2',
    primary: '32',
    primarySuffix: 'tracked',
    detail: '28 DPAs signed',
    foot: { label: 'DPAs missing', value: '4', tone: 'warn' },
    accent: 'sage',
  },
  {
    id: 'policies',
    title: 'Privacy Policies',
    icon: 'FileText',
    primary: '4',
    primarySuffix: 'published',
    detail: 'Last updated 8 days ago',
    foot: { label: 'Next review', value: 'May 12' },
    accent: 'sage',
  },
  {
    id: 'cookies',
    title: 'Cookie Consent',
    icon: 'Cookie',
    primary: '94.2%',
    primarySuffix: 'consent rate',
    detail: '5 domains \u00b7 12,847 consents this month',
    spark: COOKIE_SPARK,
    accent: 'sage',
  },
  {
    id: 'dsars',
    title: 'DSARs',
    icon: 'UserCog',
    primary: '3',
    primarySuffix: 'total',
    detail: '1 open',
    foot: { label: 'Day 8 of 30', value: 'Countdown', tone: 'warn' },
    countdown: { day: 8, total: 30 },
    accent: 'amber',
  },
  {
    id: 'breaches',
    title: 'Breaches',
    icon: 'ShieldAlert',
    primary: '0',
    primarySuffix: 'active',
    detail: '1 resolved this year',
    foot: { label: 'Status', value: 'All clear', tone: 'good' },
    accent: 'sage',
    positive: true,
  },
  {
    id: 'dpias',
    title: 'DPIAs',
    icon: 'ClipboardCheck',
    primary: '2',
    primarySuffix: 'completed',
    detail: '1 in progress',
    foot: { label: 'Next review', value: 'Jun 15' },
    accent: 'sage',
  },
  {
    id: 'training',
    title: 'Training',
    icon: 'GraduationCap',
    primary: '8 / 12',
    primarySuffix: 'members trained',
    detail: '67% completion',
    progress: 67,
    accent: 'amber',
  },
  {
    id: 'assessments',
    title: 'Assessments',
    icon: 'Gauge',
    primary: '72%',
    primarySuffix: 'last score',
    detail: 'Completed Apr 14 \u00b7 next due Jul 14',
    foot: { label: 'Trend', value: '+8 vs prior', tone: 'good' },
    accent: 'sage',
  },
  {
    id: 'audit',
    title: 'Audit Readiness',
    icon: 'FolderArchive',
    primary: 'Mar 2',
    primarySuffix: 'last generated',
    detail: 'Auto-bundled ROPA, policies, DPAs',
    cta: 'Generate fresh file',
    accent: 'sage',
  },
];

const TREND = [
  { month: 'Nov', score: 54 },
  { month: 'Dec', score: 58 },
  { month: 'Jan', score: 60 },
  { month: 'Feb', score: 64 },
  { month: 'Mar', score: 67 },
  { month: 'Apr', score: 72 },
];

const ACTIVITY = [
  { icon: 'GraduationCap', who: 'Sarah',   text: 'completed GDPR Fundamentals training', when: '2 hours ago' },
  { icon: 'UserCog',       who: 'System',  text: 'DSAR-2026-0042 response sent',          when: 'Yesterday' },
  { icon: 'Building2',     who: 'Marc',    text: 'added new vendor: Notion',              when: 'Yesterday' },
  { icon: 'Map',           who: 'Marc',    text: 'updated processing activity \u201cEmail marketing\u201d', when: '2 days ago' },
  { icon: 'Cookie',        who: 'System',  text: 'cookie scan completed for acme.com',    when: '3 days ago' },
  { icon: 'FileText',      who: 'Sarah',   text: 'generated quarterly compliance report', when: '1 week ago' },
  { icon: 'ClipboardCheck',who: 'Lena',    text: 'submitted DPIA draft for AI copywriter',when: '1 week ago' },
  { icon: 'Building2',     who: 'System',  text: 'Mailchimp DPA flagged as expired',      when: '1 week ago' },
];

const CLIENTS = [
  { name: 'ClientCo GmbH',  activities: 5, dpa: 'signed',  lastReport: 'Apr 10' },
  { name: 'Nordique AB',    activities: 3, dpa: 'signed',  lastReport: 'Mar 28' },
  { name: 'Iberia SL',      activities: 4, dpa: 'pending', lastReport: 'Never reported' },
];

Object.assign(window, {
  NAV, SUBSCORES, URGENT, MODULES, TREND, ACTIVITY, CLIENTS,
});
