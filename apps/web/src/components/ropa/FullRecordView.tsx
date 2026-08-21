"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { ArrowLeft, Printer, Baby, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompletenessRing } from './CompletenessPanel';
import { ActivityFlow } from './ActivityFlow';
import { countryName } from '@/utils/countries';
import { isRetentionPreset, normaliseLawfulBasis } from '@/utils/ropaFormat';
import {
  SCC_REPEALED_YEARS,
  normaliseTransferMechanism,
  useRopaVocabulary,
} from '@/utils/ropaVocabularies';

/**
 * Q132. Everything the register holds about one activity, on one page, read-only.
 *
 * It is deliberately not a PDF. The canonical Art. 30 export is J93 in Sprint 3 and
 * will have to carry controller identity, both records and the negative assertions;
 * this is the screen a DPO reads before a meeting and prints if they want paper.
 *
 * Empty fields are shown as "Not recorded" rather than hidden. A review view that
 * omits what is missing is the one thing a review view must not do — the absences
 * are what the reader is looking for.
 */

const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null);

function Field({ label, value, article }: { label: string; value?: React.ReactNode; article?: string }) {
  const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  return (
    <div className="space-y-1">
      <dt className="text-[11px] uppercase tracking-wider text-[#6E747A]">
        {label}
        {article && <span className="ml-1.5 normal-case tracking-normal text-[#6E747A]/70">{article}</span>}
      </dt>
      <dd className={empty ? 'text-[13px] text-[#6E747A] italic' : 'text-[13.5px] text-[#F4F5F6]'}>
        {empty ? 'Not recorded' : value}
      </dd>
    </div>
  );
}

function Section({ title, article, children }: { title: string; article?: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#08090A] hairline rounded-2xl p-6 break-inside-avoid">
      <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3 mb-4 flex items-baseline gap-2">
        {title}
        {article && <span className="text-[11px] text-[#6E747A] font-normal">{article}</span>}
      </h2>
      {children}
    </section>
  );
}

export function FullRecordView({ activity }: { activity: any }) {
  const router = useRouter();
  const t = useTranslations('ropa');
  // R142. Enum wording comes from the catalogue now, not from a table of English
  // string literals in utils/ropaVocabularies.ts.
  const vocab = useRopaVocabulary();

  const { data: dataSubjects = [] } = trpc.ropa.dataSubjects.list.useQuery({ processingActivityId: activity.id });
  const { data: dataCategories = [] } = trpc.ropa.dataCategories.list.useQuery({ processingActivityId: activity.id });
  const { data: recipients = [] } = trpc.ropa.recipients.list.useQuery({ processingActivityId: activity.id });
  const { data: transfers = [] } = trpc.ropa.transfers.list.useQuery({ processingActivityId: activity.id });
  const { data: completeness } = trpc.ropa.completeness.useQuery({ id: activity.id });
  const { data: orgMembers = [] } = trpc.team.list.useQuery();

  const memberName = (id?: string | null) => {
    if (!id) return null;
    const m = orgMembers.find((u: any) => u.id === id) as any;
    return m ? (m.name || m.email) : null;
  };

  const retention = activity.retentionPeriod
    ? (isRetentionPreset(activity.retentionPeriod)
        ? t(`editor.retention.${activity.retentionPeriod}` as any)
        : activity.retentionPeriod)
    : null;

  const basis = normaliseLawfulBasis(activity.lawfulBasis);

  return (
    <div className="flex-1 flex flex-col">
      {/* print:hidden so a printed copy is the record and not the chrome around it. */}
      <div className="border-b border-ink-900/8 bg-[#08090A]/90 backdrop-blur sticky top-0 z-20 print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/ropa/${activity.id}`)}
              aria-label={t('record.back')}
              className="text-[#6E747A] hover:text-[#F4F5F6]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-[20px] font-serif tracking-tight text-[#F4F5F6] truncate">{activity.name}</h1>
              <p className="text-[12px] text-[#6E747A]">{t('record.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {completeness && <CompletenessRing score={completeness.score} />}
            <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> {t('record.print')}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {activity.publicationExceptionReason && activity.status === 'active' && (
          <div className="bg-amber-500/10 border border-amber-900/50 text-amber-300 px-4 py-3 rounded-xl text-[12.5px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">{t('record.published_with_exception')}</span> {activity.publicationExceptionReason}
              {activity.publicationExceptionAt && (
                <span className="text-amber-300/70"> — {fmtDate(activity.publicationExceptionAt)}</span>
              )}
            </span>
          </div>
        )}

        {/* ---- Identity and purpose ---------------------------------------- */}
        <Section title={t('record.identity')} article="Art. 30(1)(a)–(b)">
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Field label={t('record.name')} value={activity.name} />
            <Field label={t('record.status')} value={t(`status_types.${activity.status}` as any)} />
            <div className="sm:col-span-2">
              <Field label={t('record.purpose')} value={activity.purpose} article="Art. 30(1)(b)" />
            </div>
            {activity.description && (
              <div className="sm:col-span-2">
                <Field label={t('record.description')} value={activity.description} />
              </div>
            )}
            <Field label={t('record.role')} value={t(`editor.legal.role_${activity.role}` as any)} article="Art. 30(1)/(2)" />
            <Field label={t('record.controller_name')} value={activity.controllerName} article="Art. 30(2)(a)" />
            <Field label={t('record.business_owner')} value={memberName(activity.businessOwnerId)} />
            <Field label={t('record.privacy_owner')} value={memberName(activity.privacyOwnerId)} />
            <Field label={t('record.risk_level')} value={t(`risk_levels.${activity.riskLevel}` as any)} />
            <Field label={t('record.published')} value={fmtDate(activity.publishedAt)} />
          </dl>
        </Section>

        {/* ---- Lawful basis ------------------------------------------------ */}
        <Section title={t('record.lawful_basis')} article="Art. 6(1)">
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Field
              label={t('record.basis')}
              value={basis ? t(`editor.legal.${basis}` as any) : null}
            />
            <Field label={t('record.basis_detail')} value={activity.lawfulBasisDetail} />
          </dl>
        </Section>

        {/* ---- Data subjects ----------------------------------------------- */}
        <Section title={t('record.data_subjects')} article="Art. 30(1)(c)">
          {dataSubjects.length === 0 ? (
            <p className="text-[13px] text-[#6E747A] italic">{t('record.no_data_subjects')}</p>
          ) : (
            <ul className="space-y-2">
              {dataSubjects.map((s: any) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 text-[13.5px] text-[#F4F5F6]">
                  {s.category}
                  {s.isChild && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-900/50">
                      <Baby className="w-3 h-3" aria-hidden="true" /> {t('categories.art8')}
                    </span>
                  )}
                  {s.isVulnerable && !s.isChild && (
                    <span className="inline-flex items-center gap-1 bg-white/5 text-[#9BA1A6] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10">
                      <ShieldAlert className="w-3 h-3" aria-hidden="true" /> {t('subjects.vulnerable')}
                    </span>
                  )}
                  <span className="text-[12px] text-[#6E747A]">
                    {s.volumeBand ? vocab.label('volume_band', s.volumeBand) : t('record.volume_not_estimated')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ---- Data categories --------------------------------------------- */}
        <Section title={t('record.data_categories')} article="Art. 30(1)(c)">
          {dataCategories.length === 0 ? (
            <p className="text-[13px] text-[#6E747A] italic">{t('record.no_data_categories')}</p>
          ) : (
            <div className="space-y-4">
              {dataCategories.map((c: any) => (
                <div key={c.id} className="border border-white/10 rounded-xl p-4 break-inside-avoid">
                  <div className="flex flex-wrap items-baseline gap-2 mb-3">
                    <span className="text-[13.5px] font-medium text-[#F4F5F6]">{c.category}</span>
                    <span className="text-[12px] text-[#6E747A]">{c.categoryGroup}</span>
                    {c.isSpecialCategory && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30">{t('categories.art9')}</span>
                    )}
                    {c.isCriminalData && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30">{t('categories.art10')}</span>
                    )}
                  </div>
                  <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                    <Field label={t('record.source')} value={c.source} article="Art. 14(2)(f)" />
                    <Field label={t('record.identifiability')} value={vocab.label('identifiability', c.identifiability)} />
                    <Field
                      label={t('record.retention')}
                      article="Art. 30(1)(f)"
                      value={c.retentionPeriod
                        ? `${c.retentionPeriod}${c.retentionTrigger ? ` — from ${vocab.label('retention_trigger', c.retentionTrigger).toLowerCase()}` : ''}`
                        : null}
                    />
                    <Field label={t('record.retention_justification')} value={c.retentionJustification} />
                    {c.isSpecialCategory && (
                      <>
                        <Field label={t('record.special_category_type')} value={vocab.label('special_category_type', c.specialCategoryType)} />
                        <Field
                          label={t('record.article_9_condition')}
                          article="Art. 9(2)"
                          value={c.article9Condition ? vocab.label('article_9_condition', c.article9Condition) : null}
                        />
                        {c.article9NationalLawBasis && (
                          <div className="sm:col-span-2">
                            <Field label={t('record.national_law')} value={c.article9NationalLawBasis} />
                          </div>
                        )}
                      </>
                    )}
                    {c.isCriminalData && (
                      <div className="sm:col-span-2">
                        <Field label={t('record.article_10_basis')} value={c.article10Basis} article="Art. 10" />
                      </div>
                    )}
                    {c.necessityJustification && (
                      <div className="sm:col-span-2">
                        <Field label={t('record.necessity')} value={c.necessityJustification} article="Art. 5(1)(c)" />
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ---- Recipients --------------------------------------------------- */}
        <Section title={t('record.recipients')} article="Art. 30(1)(d)">
          {recipients.length === 0 ? (
            <p className="text-[13px] text-[#6E747A] italic">{t('record.no_recipients')}</p>
          ) : (
            <ul className="space-y-3">
              {recipients.map((r: any) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13.5px]">
                  <span className="text-[#F4F5F6] font-medium">{r.name}</span>
                  <span className="text-[12px] text-[#9BA1A6]">
                    {r.recipientCategory ? vocab.label('recipient_category', r.recipientCategory) : t('record.uncategorised')}
                  </span>
                  <span className="text-[12px] text-[#6E747A]">
                    {r.role ? vocab.label('recipient_role', r.role) : t('record.role_not_stated')}
                  </span>
                  {r.vendorData?.headquartersCountry && (
                    <span className="text-[12px] text-[#6E747A]">{countryName(r.vendorData.headquartersCountry) || r.vendorData.headquartersCountry}</span>
                  )}
                  {r.vendorData && r.vendorData.dpaStatus !== 'signed' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-900/50">
                      {t('record.no_dpa')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ---- Transfers ---------------------------------------------------- */}
        <Section title={t('record.transfers')} article="Art. 30(1)(e) / Ch. V">
          {transfers.length === 0 ? (
            <p className="text-[13px] text-[#6E747A] italic">{t('record.no_transfers')}</p>
          ) : (
            <div className="space-y-4">
              {transfers.map((tr: any) => {
                const mech = normaliseTransferMechanism(tr.transferMechanism);
                return (
                  <div key={tr.id} className="border border-white/10 rounded-xl p-4 break-inside-avoid">
                    <div className="flex flex-wrap items-baseline gap-2 mb-3">
                      <span className="text-[13.5px] font-medium text-[#F4F5F6]">
                        {countryName(tr.destinationCountry) || tr.destinationCountry}
                      </span>
                      {tr.destinationEntity && <span className="text-[12px] text-[#6E747A]">{tr.destinationEntity}</span>}
                      <span className="text-[12px] text-[#9BA1A6]">
                        {mech ? vocab.label('transfer_mechanism', mech) : t('record.no_mechanism')}
                      </span>
                    </div>
                    <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                      {mech === 'scc' && (
                        <>
                          <Field
                            label={t('record.scc_year')}
                            value={tr.sccYear
                              ? (SCC_REPEALED_YEARS.includes(tr.sccYear)
                                  ? <span className="text-clay-600">{tr.sccYear} — {t('record.scc_repealed')}</span>
                                  : tr.sccYear)
                              : null}
                          />
                          <Field label={t('record.scc_module')} value={vocab.label('scc_module', tr.sccModule)} />
                          <Field label={t('record.execution_date')} value={fmtDate(tr.executionDate)} />
                          <Field label={t('record.annexes')} value={tr.annexesComplete ? t('record.annexes_complete') : t('record.annexes_incomplete')} />
                          <Field label={t('record.signatories')} value={tr.signatories} />
                          <Field label={t('record.expiry')} value={fmtDate(tr.expiryDate)} />
                        </>
                      )}
                      {mech === 'dpf' && (
                        <>
                          <Field label={t('record.dpf_certification')} value={tr.dpfCertificationNumber} />
                          <Field label={t('record.dpf_scope')} value={vocab.label('dpf_scope', tr.dpfScope)} />
                          <Field label={t('record.dpf_expiry')} value={fmtDate(tr.dpfExpiryDate)} />
                        </>
                      )}
                      {mech === 'bcr' && <Field label={t('record.bcr_reference')} value={tr.bcrReference} />}
                      {mech === 'adequacy_decision' && (
                        <Field label={t('record.adequacy_reference')} value={tr.adequacyDecisionReference} />
                      )}
                      {mech === 'art49_derogation' && (
                        <>
                          <Field label={t('record.derogation')} value={vocab.label('article_49_sub_reason', tr.article49SubReason)} />
                          <div className="sm:col-span-2">
                            <Field label={t('record.derogation_justification')} value={tr.article49Justification} />
                          </div>
                        </>
                      )}
                      <Field
                        label={t('record.tia')}
                        value={tr.tiaRequired
                          ? (tr.tiaCompleted ? t('record.tia_completed', { level: tr.tiaRiskLevel || '—' }) : t('record.tia_outstanding'))
                          : t('record.tia_not_required')}
                      />
                      {tr.mechanismDetail && (
                        <div className="sm:col-span-2">
                          <Field label={t('record.mechanism_detail')} value={tr.mechanismDetail} />
                        </div>
                      )}
                    </dl>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ---- Retention ---------------------------------------------------- */}
        <Section title={t('record.activity_retention')} article="Art. 30(1)(f)">
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Field label={t('record.period')} value={retention} />
            <Field label={t('record.review_date')} value={fmtDate(activity.retentionReviewDate)} />
            <div className="sm:col-span-2">
              <Field label={t('record.justification')} value={activity.retentionJustification} article="Art. 5(1)(e)" />
            </div>
            <div className="sm:col-span-2">
              <Field label={t('record.deletion_procedure')} value={activity.deletionProcedure} />
            </div>
          </dl>
          <p className="text-[12px] text-[#6E747A] mt-4">{t('record.retention_note')}</p>
        </Section>

        {/* ---- Article 22 ---------------------------------------------------- */}
        {(activity.involvesProfiling || activity.involvesAutomatedDecisionMaking) && (
          <Section title={t('record.automated_decisions')} article="Art. 22">
            <dl className="grid gap-y-4">
              <Field label={t('record.profiling')} value={activity.involvesProfiling ? t('record.yes') : t('record.no')} />
              <Field
                label={t('record.solely_automated')}
                value={activity.involvesAutomatedDecisionMaking ? t('record.yes') : t('record.no')}
              />
              {activity.involvesAutomatedDecisionMaking && (
                <>
                  <Field label={t('record.adm_logic')} value={activity.admLogic} article="Art. 13(2)(f)" />
                  <Field label={t('record.adm_significance')} value={activity.admSignificance} />
                  <Field label={t('record.adm_human')} value={activity.admHumanIntervention} article="Art. 22(3)" />
                </>
              )}
            </dl>
          </Section>
        )}

        {/* ---- Security ------------------------------------------------------ */}
        <Section title={t('record.security')} article="Art. 30(1)(g) / Art. 32">
          {Array.isArray(activity.securityMeasures) && activity.securityMeasures.length > 0 ? (
            <ul className="grid sm:grid-cols-2 gap-2 mb-4">
              {activity.securityMeasures.map((m: string) => (
                <li key={m} className="text-[13.5px] text-[#F4F5F6]">
                  {t(`editor.security.${m === 'regular_backups' ? 'backups' : m === 'audit_logging' ? 'audit_logs' : m}` as any)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#6E747A] italic mb-4">{t('record.no_security')}</p>
          )}
          <Field label={t('record.security_detail')} value={activity.securityMeasuresDetail} />
        </Section>

        {/* ---- D41: the flow ------------------------------------------------- */}
        {/* Placed after the record and before the outstanding list, because it is a
            summary of everything above it — and because on paper it is the page a
            reader looks at first and the one they keep. */}
        <Section title={t('record.flow')} article="Art. 30(1)(c)–(f)">
          <ActivityFlow activityId={activity.id} />
        </Section>

        {/* ---- What is still missing ---------------------------------------- */}
        {completeness && completeness.missing.length > 0 && (
          <Section title={t('record.outstanding')}>
            <ul className="space-y-2">
              {completeness.missing.map((m: any) => (
                <li key={m.id} className="flex items-start gap-2 text-[13px]">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${m.blocksPublication ? 'text-clay-600' : 'text-[#6E747A]'}`} />
                  <span>
                    <span className="text-[#F4F5F6]">{m.label}</span>
                    <span className="text-[#6E747A]"> — {m.article}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
