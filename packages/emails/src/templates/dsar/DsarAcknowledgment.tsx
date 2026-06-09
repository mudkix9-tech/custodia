import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { BRAND } from '../../constants';

type DsarAcknowledgmentProps = {
  subjectName: string;
  requestType: string;
  referenceNumber: string;
  orgName: string;
  orgLogo?: string;
  locale?: string;
};

const translations: Record<string, any> = {
  en: {
    preview: "we'll respond within 30 days",
    dear: "Dear",
    received: "We have received your",
    requestAssigned: "request and assigned it reference number",
    whatHappensNext: "What happens next:",
    verify: "We will verify your identity",
    search: "We will search our systems for your data",
    respond: "We will respond within 30 days of receipt",
    questions: "If you have questions, reply to this email.",
    regards: "Kind regards,"
  },
  de: {
    preview: "wir werden innerhalb von 30 Tagen antworten",
    dear: "Hallo",
    received: "Wir haben Ihre Anfrage bezüglich",
    requestAssigned: "erhalten und ihr die Referenznummer zugewiesen:",
    whatHappensNext: "Wie es weitergeht:",
    verify: "Wir werden Ihre Identität überprüfen",
    search: "Wir werden unsere Systeme nach Ihren Daten durchsuchen",
    respond: "Wir werden innerhalb von 30 Tagen nach Eingang antworten",
    questions: "Wenn Sie Fragen haben, antworten Sie auf diese E-Mail.",
    regards: "Mit freundlichen Grüßen,"
  },
  fr: {
    preview: "nous répondrons dans les 30 jours",
    dear: "Bonjour",
    received: "Nous avons reçu votre demande de",
    requestAssigned: "et lui avons attribué le numéro de référence",
    whatHappensNext: "Et ensuite :",
    verify: "Nous vérifierons votre identité",
    search: "Nous chercherons vos données dans nos systèmes",
    respond: "Nous répondrons dans les 30 jours suivant la réception",
    questions: "Si vous avez des questions, répondez à cet e-mail.",
    regards: "Cordialement,"
  }
};

export const DsarAcknowledgment = ({
  subjectName = 'John Doe',
  requestType = 'Right to Erasure',
  referenceNumber = 'DSAR-2026-0042',
  orgName = 'Acme Corp',
  orgLogo,
  locale = 'en'
}: DsarAcknowledgmentProps) => {
  const t = translations[locale] || translations.en;

  return (
    <Layout
      previewText={`Reference: [${referenceNumber}] — ${t.preview}`}
      orgName={orgName}
      orgLogo={orgLogo}
    >
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        {t.dear} {subjectName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        {t.received} {requestType} {t.requestAssigned} <strong>{referenceNumber}</strong>.
      </Text>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        {t.whatHappensNext}
      </Text>

      <ul style={{ margin: '0 0 24px', paddingLeft: '20px', color: BRAND.textPrimary, fontSize: '15px' }}>
        <li style={{ marginBottom: '8px' }}>{t.verify}</li>
        <li style={{ marginBottom: '8px' }}>{t.search}</li>
        <li style={{ marginBottom: '8px' }}>{t.respond}</li>
      </ul>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        {t.questions}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 4px' }}>
        {t.regards}
      </Text>
      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0' }}>
        {orgName}
      </Text>
    </Layout>
  );
};

export default DsarAcknowledgment;
