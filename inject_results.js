const fs = require('fs');
let code = fs.readFileSync('apps/web/src/app/[locale]/(public)/assessment/results/page.tsx', 'utf8');

code = code.replace(/import \{ useSearchParams, useRouter \} from \'next\/navigation\';/, 'import { useSearchParams, useRouter, useParams } from \'next/navigation\';\nimport { useTranslations } from \'next-intl\';');

code = code.replace(/const searchParams = useSearchParams\(\);/, 'const searchParams = useSearchParams();\n  const params = useParams();\n  const locale = (params?.locale as string) || \'en\';\n  const t = useTranslations(\'marketing.assessmentResults\');');

// State expires
code = code.replace(/>Assessment expired</, '>{t(\'expiredTitle\')}<');
code = code.replace(/>This assessment was completed over 30 days ago and is no longer available\.</, '>{t(\'expiredDesc\')}<');
code = code.replace(/>\s*Start new assessment\s*</, '>{t(\'startNewBtn\')}<');

// Share results
code = code.replace(/\{copiedLink \? \'Copied\' : \'Share results\'\}/, '{copiedLink ? t(\'copied\') : t(\'shareLink\')}');

// State 1
code = code.replace(/>Assessment complete</, '>{t(\'assessmentComplete\')}<');
code = code.replace(/>Ref \{reportRef\}</, '>{t(\'ref\', { ref: reportRef })}<');
code = code.replace(/>Median score for agencies at first assessment: 55</, '>{t(\'medianScore\')}<');
code = code.replace(/>High severity</, '>{t(\'highSeverity\')}<');
code = code.replace(/>Medium severity</, '>{t(\'mediumSeverity\')}<');
code = code.replace(/>Total findings</, '>{t(\'totalFindings\')}<');
code = code.replace(/>Score by category</g, '>{t(\'scoreByCategory\')}<');
code = code.replace(/>Findings</, '>{t(\'findings\')}<');
code = code.replace(/>Ordered by severity — the full report includes every finding and its remediation step\.</, '>{t(\'findingsDesc\')}<');
code = code.replace(/>\{lockedCount\} further finding\{lockedCount === 1 \? \'\' : \'s\'\} \{lockedCount === 1 \? \'is\' : \'are\'\} in the full report\.</, '>{t(\'furtherFindings\', { count: lockedCount })}<');
code = code.replace(/>Unlock below ↓</, '>{t(\'unlockBelow\')}<');

// Send my report
code = code.replace(/>Send my report</, '>{t(\'sendReportHeader\')}<');
code = code.replace(/>One email, containing your PDF. No sequence, no sales call — unsubscribe is a single click and your assessment stays valid either way\.</, '>{t(\'sendReportDesc\')}<');
code = code.replace(/placeholder="name@company.eu"/, 'placeholder={t(\'emailPlaceholder\')}');
code = code.replace(/placeholder="Company \(optional\)"/, 'placeholder={t(\'companyPlaceholder\')}');
code = code.replace(/>Keep me updated about Custodia, including product news and offers</, '>{t(\'marketingConsent\')}<');
code = code.replace(/>\{isCapturing \? \'Processing…\' : \'Email me the full report\'\}</, '>{isCapturing ? t(\'emailMeProcessing\') : t(\'emailMeBtn\')}<');
code = code.replace(/'Enter a valid email address so we can send the report\.'/, 't(\'emailNoteError\')');
code = code.replace(/'We will email you a secure magic link\. No password required\.'/, 't(\'emailNote\')');
code = code.replace(/>Stored in the EU</, '>{t(\'storedEU\')}<');
code = code.replace(/>Deleted after 90 days on request</, '>{t(\'deleted90Days\')}<');

// State 2
code = code.replace(/>Check your email</, '>{t(\'checkEmailTitle\')}<');
code = code.replace(/We\&apos;ve sent a magic link to <span className="text-\[\#F4F5F6\] font-medium\">\{email\}<\/span>\.<br \/>\s*Click the link to securely access your complete GDPR gap assessment\./, '{t(\'checkEmailDesc1\')}<span className="text-[#F4F5F6] font-medium">{email}</span>.<br />{t(\'checkEmailDesc2\')}');
code = code.replace(/>\s*Resend magic link\s*</, '>{t(\'resendLink\')}<');
code = code.replace(/>\s*Wrong email\?\s*</, '>{t(\'wrongEmail\')}<');

// State 3
code = code.replace(/>Full report</, '>{t(\'fullReportBadge\')}<');
code = code.replace(/>GDPR audit readiness report</, '>{t(\'fullReportTitle\')}<');
code = code.replace(/>\{isDownloading \? \'Generating…\' : \'Download PDF report\'\}</, '>{isDownloading ? t(\'generatingPdf\') : t(\'downloadPdf\')}<');
code = code.replace(/>Your action plan</, '>{t(\'actionPlan\')}<');
code = code.replace(/Fix issue <ArrowRight/, '{t(\'fixIssue\')} <ArrowRight');
code = code.replace(/>Fix these issues automatically\.</, '>{t(\'fixAutomaticallyTitle\')}<');
code = code.replace(/>\s*Custodia replaces your spreadsheets with a dynamic compliance operating system\. Start resolving these action items today\.\s*</, '>{t(\'fixAutomaticallyDesc\')}<');
code = code.replace(/>\s*View Custodia plans\s*</, '>{t(\'viewPlans\')}<');

fs.writeFileSync('apps/web/src/app/[locale]/(public)/assessment/results/page.tsx', code);
