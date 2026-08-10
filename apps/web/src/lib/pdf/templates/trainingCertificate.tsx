import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { palette, formatDate } from '../theme';

export interface TrainingCertificateData {
  recipientName: string;
  moduleTitle: string;
  score: number;
  completedAt: string;
  organizationName: string;
  certificateId: string;
}

/**
 * The one document in the family that is landscape and ceremonial rather than a
 * report. It keeps the house palette and type but drops the running chrome —
 * a certificate with a page-number footer reads as a printout, not an award.
 */
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    color: palette.ink,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    paddingVertical: 45,
    paddingHorizontal: 55,
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.rule,
    paddingTop: 42,
    paddingHorizontal: 55,
    paddingBottom: 34,
    position: 'relative',
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 8, backgroundColor: palette.brand },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 46 },
  brandLockup: { flexDirection: 'row', alignItems: 'center' },
  logoBox: {
    width: 18,
    height: 18,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  logoInner: { width: 6, height: 6, backgroundColor: palette.cream },
  brandText: { fontFamily: 'Geist', fontWeight: 600, fontSize: 13, letterSpacing: 2, color: palette.ink },
  subBrand: { fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: palette.muted },
  eyebrow: { fontSize: 8.5, letterSpacing: 2, textTransform: 'uppercase', color: palette.muted, marginBottom: 14 },
  title: { fontFamily: 'Geist', fontWeight: 600, fontSize: 34, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 11, color: palette.bodySoft, marginBottom: 34 },
  presentedTo: { fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', color: palette.muted, marginBottom: 10 },
  name: { fontFamily: 'Geist', fontWeight: 600, fontSize: 27, letterSpacing: -0.4, marginBottom: 12 },
  rule: { height: 1, width: 150, backgroundColor: palette.ink, marginBottom: 22 },
  citation: { fontSize: 10.5, lineHeight: 1.6, color: palette.body, maxWidth: 430, marginBottom: 34 },
  moduleName: { fontFamily: 'Geist', fontWeight: 600 },
  metaRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: palette.rule,
    paddingTop: 16,
    position: 'absolute',
    left: 55,
    right: 55,
    bottom: 34,
  },
  metaCol: { marginRight: 46 },
  metaLabel: { fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: palette.muted, marginBottom: 4 },
  metaValue: { fontFamily: 'Geist', fontWeight: 500, fontSize: 10 },
  scoreValue: { fontFamily: 'Geist', fontWeight: 600, fontSize: 10, color: palette.good },
});

export const TrainingCertificate: React.FC<{ data: TrainingCertificateData }> = ({ data }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.topBar} />
      <View style={styles.frame}>
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <View style={styles.logoBox}>
              <View style={styles.logoInner} />
            </View>
            <Text style={styles.brandText}>CUSTODIA</Text>
          </View>
          <Text style={styles.subBrand}>GDPR Compliance Platform</Text>
        </View>

        <Text style={styles.eyebrow}>Certificate of Completion</Text>
        <Text style={styles.title}>GDPR &amp; Data Protection Training</Text>
        <Text style={styles.subtitle}>Issued by {data.organizationName}</Text>

        <Text style={styles.presentedTo}>This certifies that</Text>
        <Text style={styles.name}>{data.recipientName}</Text>
        <View style={styles.rule} />

        <Text style={styles.citation}>
          has successfully completed <Text style={styles.moduleName}>{data.moduleTitle}</Text>, meeting the
          assessment standard required under the organisation&apos;s data protection training programme.
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Assessment score</Text>
            <Text style={styles.scoreValue}>{data.score}%</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date of completion</Text>
            <Text style={styles.metaValue}>{formatDate(data.completedAt)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Certificate ID</Text>
            <Text style={styles.metaValue}>{data.certificateId}</Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);
