import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Shared react-pdf design kit.
 *
 * The vocabulary here is lifted from templates/assessmentReport.tsx, which was
 * the first document rendered this way and set the house style: a cream-and-ink
 * palette, Geist for display and Inter for body, numbered sections, and tables
 * ruled with hairlines rather than boxed cells. Every other report now composes
 * these primitives so the twelve documents read as one family.
 *
 * Fonts are registered in pdfRenderer.tsx, which every caller imports first.
 */

export const palette = {
  ink: '#16181A',
  body: '#22262A',
  bodySoft: '#3D4142',
  muted: '#5A5F57',
  mutedAlt: '#4C5150',
  brand: '#3F5B3C',
  cream: '#F7F5EF',
  rule: '#D8D6CE',
  ruleLight: '#E4E2DA',
  track: '#E8E6DE',
  good: '#2E7D4F',
  warn: '#B06A00',
  bad: '#B02A20',
} as const;

/** Score bands match the assessment report's legend: 76+/51+/below. */
export const scoreColor = (score: number) => {
  if (score >= 76) return palette.good;
  if (score >= 51) return palette.warn;
  return palette.bad;
};

/**
 * Severity strings arrive from several tables with inconsistent casing and
 * vocabulary (`critical`, `High`, `not_started`), so normalise before mapping.
 */
export const severityColor = (severity: string | null | undefined) => {
  switch ((severity || '').toLowerCase().replace(/[\s_-]/g, '')) {
    case 'critical':
    case 'high':
    case 'expired':
      return palette.bad;
    case 'medium':
    case 'moderate':
    case 'sent':
    case 'draft':
      return palette.warn;
    case 'low':
    case 'signed':
    case 'complete':
    case 'completed':
    case 'resolved':
      return palette.good;
    default:
      return palette.muted;
  }
};

export const formatDate = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().split('T')[0] || '—';
};

export const titleCase = (s: string | null | undefined) =>
  !s ? '—' : s.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    color: palette.ink,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    height: '100%',
  },
  contentPage: {
    fontFamily: 'Inter',
    color: palette.ink,
    backgroundColor: '#FFFFFF',
    paddingTop: 85,
    paddingHorizontal: 50,
    paddingBottom: 85,
  },

  // — Cover ———————————————————————————————————————————————
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 12, backgroundColor: palette.brand },
  coverHeader: {
    position: 'absolute',
    top: 50,
    left: 50,
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoBox: {
    width: 20,
    height: 20,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoInner: { width: 6.8, height: 6.8, backgroundColor: palette.cream },
  brandText: { fontFamily: 'Geist', fontWeight: 600, fontSize: 15, letterSpacing: 2, color: palette.ink },
  subBrandText: { fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: palette.muted },
  coverTitleArea: { position: 'absolute', top: 180, left: 50, right: 50 },
  coverEyebrow: {
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.muted,
    marginBottom: 20,
  },
  coverTitle: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 31,
    lineHeight: 1.12,
    letterSpacing: -0.5,
    maxWidth: 360,
  },
  dividerLine: { height: 1, backgroundColor: palette.ink, marginVertical: 25, width: 90 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  metaCol: { marginRight: 40, marginBottom: 14, maxWidth: 180 },
  metaLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.muted,
    marginBottom: 5,
  },
  metaValue: { fontFamily: 'Geist', fontWeight: 500, fontSize: 11.5 },
  coverNote: {
    position: 'absolute',
    bottom: 80,
    left: 50,
    right: 50,
    fontSize: 8.5,
    lineHeight: 1.6,
    color: palette.bodySoft,
    maxWidth: 340,
  },

  // — Running chrome ——————————————————————————————————————
  pageHeader: {
    position: 'absolute',
    top: 40,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: palette.rule,
    paddingBottom: 10,
  },
  pageHeaderText: { fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: palette.mutedAlt },
  pageHeaderBrand: { fontFamily: 'Geist', fontWeight: 600, letterSpacing: 1.5 },
  footer: {
    position: 'absolute',
    bottom: 35,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderColor: palette.rule,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7.5, letterSpacing: 0.5, color: palette.mutedAlt },

  // — Sections ————————————————————————————————————————————
  sectionTitleFlex: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 15 },
  sectionNum: { fontFamily: 'Geist', fontWeight: 500, fontSize: 8.5, color: palette.muted, marginRight: 10 },
  sectionTitleText: { fontFamily: 'Geist', fontWeight: 600, fontSize: 15, letterSpacing: -0.5 },
  sectionDesc: { fontSize: 9, color: palette.bodySoft, marginBottom: 20, maxWidth: 400 },
  sectionBlock: { marginBottom: 30 },
  bodyText: { fontSize: 10.5, lineHeight: 1.65, color: palette.body, maxWidth: 425, marginBottom: 20 },

  // — Stats ———————————————————————————————————————————————
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 25 },
  statCell: { borderTopWidth: 1, borderColor: palette.ink, paddingTop: 10, marginRight: 25, minWidth: 92 },
  statValue: { fontFamily: 'Geist', fontWeight: 600, fontSize: 23, letterSpacing: -0.5 },
  statLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.muted,
    marginTop: 5,
  },

  // — Tables ——————————————————————————————————————————————
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: palette.ink,
    paddingBottom: 5,
    marginBottom: 3,
  },
  tableHeaderText: { fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: palette.mutedAlt },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderColor: palette.ruleLight,
    paddingVertical: 9,
  },
  cellText: { fontSize: 9, lineHeight: 1.45, color: palette.body },
  cellStrong: { fontFamily: 'Geist', fontWeight: 500, fontSize: 9.5, color: palette.ink },
  emptyText: { fontSize: 9, color: palette.muted, paddingVertical: 14 },

  // — Key/value ————————————————————————————————————————————
  kvRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: palette.ruleLight,
    paddingVertical: 8,
  },
  kvLabel: {
    width: 150,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.muted,
    paddingTop: 1.5,
  },
  kvValue: { flex: 1, fontSize: 9.5, lineHeight: 1.45, color: palette.body },

  // — Badges & bullets ———————————————————————————————————
  badge: { borderWidth: 1, paddingVertical: 3, paddingHorizontal: 6, alignSelf: 'flex-start' },
  badgeText: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dotRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  bulletRow: { flexDirection: 'row', marginBottom: 8, maxWidth: 425 },
  bulletMark: { fontSize: 9.5, color: palette.muted, width: 14 },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.5, color: palette.body },

  // — Bars ————————————————————————————————————————————————
  barTrack: { height: 4, backgroundColor: palette.track, flex: 1, marginRight: 10 },
  barFill: { height: 4 },
});

export interface CoverMeta {
  label: string;
  value: string;
}

export const Cover: React.FC<{
  eyebrow: string;
  title: string;
  meta: CoverMeta[];
  note?: string;
  children?: React.ReactNode;
}> = ({ eyebrow, title, meta, note, children }) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.topBar} />

    <View style={styles.coverHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.logoBox}>
          <View style={styles.logoInner} />
        </View>
        <Text style={styles.brandText}>CUSTODIA</Text>
      </View>
      <Text style={styles.subBrandText}>GDPR Compliance Platform</Text>
    </View>

    <View style={styles.coverTitleArea}>
      <Text style={styles.coverEyebrow}>{eyebrow}</Text>
      <Text style={styles.coverTitle}>{title}</Text>
      <View style={styles.dividerLine} />
      <View style={styles.metaGrid}>
        {meta.map((m, i) => (
          <View key={i} style={styles.metaCol}>
            <Text style={styles.metaLabel}>{m.label}</Text>
            <Text style={styles.metaValue}>{m.value}</Text>
          </View>
        ))}
      </View>
    </View>

    {children}

    {note ? <Text style={styles.coverNote}>{note}</Text> : null}
    <Footer />
  </Page>
);

export const RunningHeader: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.pageHeader} fixed>
    <Text style={styles.pageHeaderText}>
      <Text style={styles.pageHeaderBrand}>CUSTODIA</Text> {'   '}
      {label}
    </Text>
  </View>
);

export const Footer: React.FC = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Generated by Custodia | trycustodia.com | Confidential</Text>
    <Text
      style={styles.footerText}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  </View>
);

/**
 * A content page with the running chrome already attached. `wrap` is on by
 * default so long tables flow across as many pages as they need.
 */
export const ContentPage: React.FC<{
  headerLabel: string;
  landscape?: boolean;
  children: React.ReactNode;
}> = ({ headerLabel, landscape, children }) => (
  <Page size="A4" orientation={landscape ? 'landscape' : 'portrait'} style={styles.contentPage} wrap>
    <RunningHeader label={headerLabel} />
    {children}
    <Footer />
  </Page>
);

export const Section: React.FC<{
  num: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}> = ({ num, title, description, children }) => (
  <View style={styles.sectionBlock}>
    <View style={styles.sectionTitleFlex}>
      <Text style={styles.sectionNum}>{num}</Text>
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
    {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
    {children}
  </View>
);

export const StatGrid: React.FC<{ items: Array<{ value: string | number; label: string; color?: string }> }> = ({
  items,
}) => (
  <View style={styles.statGrid}>
    {items.map((s, i) => (
      <View key={i} style={styles.statCell}>
        <Text style={[styles.statValue, s.color ? { color: s.color } : {}]}>{s.value}</Text>
        <Text style={styles.statLabel}>{s.label}</Text>
      </View>
    ))}
  </View>
);

export interface Column {
  header: string;
  /** Flex weight, or a fixed point width when `fixed` is set. */
  width: number;
  fixed?: boolean;
  align?: 'left' | 'right';
}

/**
 * Rows are arrays of cells positionally matched to `columns`. A cell may be a
 * node so callers can drop in a Badge or a bar without a bespoke table.
 */
export const DataTable: React.FC<{
  columns: Column[];
  rows: Array<Array<React.ReactNode>>;
  empty?: string;
}> = ({ columns, rows, empty = 'No records for this period.' }) => {
  const cellStyle = (c: Column) => ({
    ...(c.fixed ? { width: c.width } : { flex: c.width }),
    paddingRight: 8,
    ...(c.align === 'right' ? { textAlign: 'right' as const } : {}),
  });

  return (
    <View>
      <View style={styles.tableHeader}>
        {columns.map((c, i) => (
          <Text key={i} style={[styles.tableHeaderText, cellStyle(c)]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>{empty}</Text>
      ) : (
        rows.map((row, ri) => (
          <View key={ri} style={styles.tableRow} wrap={false}>
            {columns.map((c, ci) => {
              const cell = row[ci];
              return (
                <View key={ci} style={cellStyle(c)}>
                  {typeof cell === 'string' || typeof cell === 'number' ? (
                    <Text style={styles.cellText}>{cell}</Text>
                  ) : (
                    cell ?? <Text style={styles.cellText}>—</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
};

export const KeyValue: React.FC<{ rows: Array<{ label: string; value: React.ReactNode }> }> = ({ rows }) => (
  <View>
    {rows.map((r, i) => (
      <View key={i} style={styles.kvRow} wrap={false}>
        <Text style={styles.kvLabel}>{r.label}</Text>
        {typeof r.value === 'string' || typeof r.value === 'number' ? (
          <Text style={styles.kvValue}>{r.value}</Text>
        ) : (
          <View style={{ flex: 1 }}>{r.value}</View>
        )}
      </View>
    ))}
  </View>
);

export const Badge: React.FC<{ label: string; color?: string }> = ({ label, color }) => {
  const c = color ?? severityColor(label);
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <Text style={[styles.badgeText, { color: c }]}>{titleCase(label)}</Text>
    </View>
  );
};

export const DotLabel: React.FC<{ label: string; color?: string }> = ({ label, color }) => {
  const c = color ?? severityColor(label);
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.cellText, { color: c }]}>{titleCase(label)}</Text>
    </View>
  );
};

export const ScoreBar: React.FC<{ score: number }> = ({ score }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: scoreColor(score) }]} />
    </View>
    <Text style={[styles.cellStrong, { width: 32, textAlign: 'right' }]}>{score}%</Text>
  </View>
);

export const Bullets: React.FC<{ items: string[]; empty?: string }> = ({ items, empty }) => {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>{empty || 'Nothing recorded.'}</Text>;
  }
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bulletMark}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
};

export const Report: React.FC<{ children: React.ReactNode }> = ({ children }) => <Document>{children}</Document>;
