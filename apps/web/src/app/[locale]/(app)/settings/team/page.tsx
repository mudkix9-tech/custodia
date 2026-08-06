"use client";

import { useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Crown, Lock, Mail, Search, Trash2, Upload, UserPlus, X } from 'lucide-react';

import { trpc } from '@/utils/trpc';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from '@/components/ui/select';
import { SettingsPage, SettingsHeader } from '@/components/settings/SettingsPage';
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEmptyState,
} from '@/components/settings/SettingsCard';
import {
  GoldBadge,
  IconAction,
  InitialAvatar,
  SettingsMeter,
  StatusDot,
} from '@/components/settings/SettingsBits';
import { useSettingsToast } from '@/components/settings/SettingsToast';
import { cn } from '@/utils/cn';

const MODULES = ['ROPA', 'Vendors', 'DSARs', 'Breaches', 'Training', 'Billing', 'Users'] as const;
const ACTIONS = ['View', 'Edit', 'Manage'] as const;
const PERM_STATES = ['inherit', 'allow', 'deny'] as const;

type PermState = (typeof PERM_STATES)[number];
type BasicRole = 'admin' | 'member' | 'viewer';

/** Shape of `team.list` rows — the router returns them untyped. */
type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: 'owner' | BasicRole;
  customRoleId: string | null;
  permissions: string[] | null;
  invitedAt: string | Date | null;
  emailVerified: string | Date | null;
  createdAt: string | Date | null;
};

type CustomRole = { id: string; name: string };

/** Grid track shared by the members header row and each member row. */
const MEMBER_GRID = 'grid min-w-[880px] grid-cols-[1.5fr_1.7fr_150px_1fr_128px] gap-4';

const EMAIL_RE = /[^\s,;<>"]+@[^\s,;<>"]+\.[^\s,;<>"]+/g;

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.team');
  const toast = useSettingsToast();
  const { confirm, dialog } = useConfirm();

  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role || 'member';
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const isOwner = userRole === 'owner';

  const { data: teamData, isLoading, refetch } = trpc.team.list.useQuery();
  const { data: customRoleData } = trpc.customRoles.list.useQuery(undefined, { enabled: isAdmin });
  const updateRole = trpc.team.updateRole.useMutation();
  const updatePermissions = trpc.team.updatePermissions.useMutation();
  const removeMember = trpc.team.remove.useMutation();
  const inviteMember = trpc.team.bulkInvite.useMutation();
  const resendInvite = trpc.team.resendInvite.useMutation();

  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [inviteRole, setInviteRole] = useState<BasicRole>('member');
  const [isSending, setIsSending] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, string[]>>({});
  const csvInput = useRef<HTMLInputElement>(null);

  const members: TeamMember[] = teamData ?? [];
  const customRoles: CustomRole[] = customRoleData ?? [];
  const pending = useMemo(
    () => members.filter((m) => m.invitedAt && !m.emailVerified),
    [members]
  );
  const activeCount = members.length - pending.length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, query]);

  /* ---------------------------------------------------------------- invite */

  const addRecipients = (raw: string) => {
    const found = raw.match(EMAIL_RE);
    if (!found) return false;
    setRecipients((prev) => Array.from(new Set([...prev, ...found])));
    return true;
  };

  const commitDraft = () => {
    if (addRecipients(draft)) setDraft('');
  };

  const handleDraftKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === 'Backspace' && !draft && recipients.length) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    if (!addRecipients(text)) toast(t('invite.csv_empty'), 'error');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = Array.from(new Set([...recipients, ...(draft.match(EMAIL_RE) ?? [])]));
    if (!emails.length) {
      toast(t('invite.needs_email'), 'error');
      return;
    }

    setIsSending(true);
    try {
      const result = await inviteMember.mutateAsync({ emails, role: inviteRole });
      setRecipients([]);
      setDraft('');

      if (result.sentCount === 0) {
        toast(t('invite.invalid_only', { invalid: result.invalidCount }), 'error');
      } else if (result.failedCount > 0) {
        toast(
          t('invite.send_failures', {
            sent: result.sentCount,
            failed: result.failedCount,
            duplicates: result.duplicateCount,
            invalid: result.invalidCount,
          }),
          'error'
        );
      } else if (result.duplicateCount > 0 || result.invalidCount > 0) {
        toast(
          t('invite.partial_success', {
            sent: result.sentCount,
            duplicates: result.duplicateCount,
            invalid: result.invalidCount,
          }),
          'info'
        );
      } else {
        toast(t('invite.sent', { count: result.sentCount }));
      }
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('invite.failed'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  /* --------------------------------------------------------------- members */

  const handleUpdateRole = async (userId: string, name: string, value: string) => {
    const custom = customRoles.find((r) => r.id === value);
    try {
      await updateRole.mutateAsync({
        userId,
        role: custom ? 'member' : (value as BasicRole),
        customRoleId: custom ? value : null,
      });
      const label = custom ? custom.name : t(`members.roles.${value}` as 'members.roles.admin');
      toast(t('members.role_updated', { name, role: label }));
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('members.role_failed'), 'error');
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    const confirmed = await confirm({
      title: t('members.remove_confirm.title', { name }),
      description: t('members.remove_confirm.description', { name }),
      variant: 'destructive',
      confirmText: t('members.remove'),
    });
    if (!confirmed) return;
    try {
      await removeMember.mutateAsync({ userId });
      setExpandedId(null);
      toast(t('members.removed', { name }));
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('members.remove_failed'), 'error');
    }
  };

  const handleResend = async (userId: string, email: string) => {
    try {
      await resendInvite.mutateAsync({ userId });
      toast(t('pending.resent', { email }));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('pending.resend_failed'), 'error');
    }
  };

  const permsFor = (member: TeamMember) => permDraft[member.id] ?? member.permissions ?? [];

  const readPerm = (perms: string[], mod: string, action: string): PermState => {
    const entry = perms.find((p) => p.startsWith(`${mod}:${action}:`));
    return (entry?.split(':')[2] as PermState) || 'inherit';
  };

  const cyclePerm = async (member: TeamMember, mod: string, action: string) => {
    const perms = permsFor(member);
    const next = PERM_STATES[(PERM_STATES.indexOf(readPerm(perms, mod, action)) + 1) % 3];
    const updated = [
      ...perms.filter((p) => !p.startsWith(`${mod}:${action}:`)),
      `${mod}:${action}:${next}`,
    ];

    setPermDraft((prev) => ({ ...prev, [member.id]: updated }));
    try {
      await updatePermissions.mutateAsync({ userId: member.id, permissions: updated });
      refetch();
    } catch (err) {
      setPermDraft((prev) => ({ ...prev, [member.id]: perms }));
      toast(err instanceof Error ? err.message : t('permissions.failed'), 'error');
    }
  };

  if (isLoading) return <GenericWorkspaceSkeleton />;

  return (
    <SettingsPage>
      <SettingsHeader
        title={t('title')}
        subtitle={t('subtitle')}
        aside={
          <SettingsMeter
            label={t('meter.label')}
            value={`${activeCount} / ${members.length}`}
            percent={members.length ? (activeCount / members.length) * 100 : 0}
            note={
              pending.length
                ? t('meter.pending_note', { count: pending.length })
                : t('meter.all_active')
            }
          />
        }
      />

      {isAdmin && (
        <SettingsCard className="rise-in mb-5">
          <SettingsCardHeader
            icon={UserPlus}
            title={t('invite.title')}
            action={
              <>
                <input
                  ref={csvInput}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsv}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => csvInput.current?.click()}
                  className="flex items-center gap-1.5 text-[12.5px] text-set-fg-muted transition-colors hover:text-set-gold"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('invite.bulk_csv')}
                </button>
              </>
            }
          />

          <form onSubmit={handleInvite} className="px-[22px] pb-5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
              <div
                onClick={(e) =>
                  (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()
                }
                className="flex min-h-[46px] flex-1 flex-wrap items-center gap-1.5 rounded-[10px] border border-set-line-strong bg-set-field px-2.5 py-[7px]"
              >
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="flex h-7 items-center gap-[7px] rounded-[7px] border border-set-gold/28 bg-set-gold/11 pr-2 pl-2.5"
                  >
                    <span className="font-mono text-xs text-set-gold-hi">{email}</span>
                    <button
                      type="button"
                      aria-label={t('invite.remove_recipient', { email })}
                      onClick={() => setRecipients((prev) => prev.filter((r) => r !== email))}
                      className="text-set-gold-hi/60 transition-colors hover:text-set-gold-hi"
                    >
                      <X className="h-3 w-3" strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleDraftKey}
                  onBlur={commitDraft}
                  placeholder={t('invite.email_placeholder')}
                  className="h-[30px] min-w-[220px] flex-1 border-none bg-transparent text-[13.5px] text-set-fg placeholder:text-set-fg-subtle focus:outline-none"
                />
              </div>

              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as BasicRole)}>
                <SelectTrigger className="h-[46px] w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('invite.roles.admin')}</SelectItem>
                  <SelectItem value="member">{t('invite.roles.member')}</SelectItem>
                  <SelectItem value="viewer">{t('invite.roles.viewer')}</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" disabled={isSending} className="h-[46px] px-5">
                {isSending
                  ? t('invite.sending')
                  : recipients.length > 1
                    ? t('invite.send_many', { count: recipients.length })
                    : t('invite.send')}
              </Button>
            </div>
            <p className="pt-2.5 text-[11.5px] text-set-fg-subtle">{t('invite.footnote')}</p>
          </form>
        </SettingsCard>
      )}

      <SettingsCard className="mb-5 overflow-hidden">
        <SettingsCardHeader
          title={t('members.title')}
          count={visible.length}
          action={
            <div className="flex h-8 w-[230px] items-center gap-2 rounded-lg border border-[#1A1A1E] bg-set-field px-3">
              <Search className="h-3.5 w-3.5 flex-none text-set-fg-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('members.filter_placeholder')}
                className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-set-fg placeholder:text-set-fg-subtle focus:outline-none"
              />
            </div>
          }
        />

        <div className="overflow-x-auto">
        <div
          className={cn(
            MEMBER_GRID,
            'set-eyebrow border-b border-set-line-rail px-[22px] pb-2.5 tracking-[0.14em]'
          )}
        >
          <div>{t('members.columns.name')}</div>
          <div>{t('members.columns.email')}</div>
          <div>{t('members.columns.role')}</div>
          <div>{t('members.columns.status')}</div>
          <div className="text-right">{t('members.columns.actions')}</div>
        </div>

        {visible.map((member) => {
          const isSelf = member.id === currentUserId;
          const isMemberOwner = member.role === 'owner';
          const isInvited = !!member.invitedAt && !member.emailVerified;
          const canEditRole = isAdmin && !isSelf && (!isMemberOwner || isOwner);
          const canRemove = isAdmin && !isSelf && !isMemberOwner;
          const isExpanded = expandedId === member.id;
          const perms = permsFor(member);
          const overrides = perms.filter((p) => !p.endsWith(':inherit')).length;

          return (
            <div key={member.id} className="border-b border-set-line-soft last:border-b-0">
              <div
                className={cn(
                  MEMBER_GRID,
                  'items-center px-[22px] py-3.5 transition-colors hover:bg-set-row-hover'
                )}
              >
                <div className="flex min-w-0 items-center gap-[11px]">
                  <InitialAvatar name={member.name || member.email} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-set-fg">
                      {member.name || t('members.invited_user')}
                    </div>
                    <div className="text-[11.5px] text-set-fg-muted">
                      {isSelf
                        ? t('members.meta_you')
                        : isInvited
                          ? t('members.meta_awaiting')
                          : t(`members.roles.${member.role}` as 'members.roles.member')}
                    </div>
                  </div>
                </div>

                <div className="truncate font-mono text-[12.5px] text-set-fg-muted">
                  {member.email}
                </div>

                <div>
                  {isMemberOwner && !isOwner ? (
                    <GoldBadge icon={Crown}>{t('members.roles.owner')}</GoldBadge>
                  ) : canEditRole ? (
                    <Select
                      value={member.customRoleId || member.role}
                      onValueChange={(v) =>
                        handleUpdateRole(member.id, member.name || member.email, v)
                      }
                    >
                      <SelectTrigger className="h-[30px] text-[12.5px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <div className="set-eyebrow px-2 py-1">
                            {t('members.roles.basic_roles')}
                          </div>
                          <SelectItem value="owner" disabled>
                            {t('members.roles.owner')}
                          </SelectItem>
                          <SelectItem value="admin">{t('members.roles.admin')}</SelectItem>
                          <SelectItem value="member">{t('members.roles.member')}</SelectItem>
                          <SelectItem value="viewer">{t('members.roles.viewer')}</SelectItem>
                        </SelectGroup>
                        {customRoles.length > 0 && (
                          <SelectGroup>
                            <div className="set-eyebrow mt-2 px-2 py-1">
                              {t('members.roles.custom_roles')}
                            </div>
                            {customRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <GoldBadge icon={isMemberOwner ? Crown : undefined}>
                      {t(`members.roles.${member.role}` as 'members.roles.member')}
                    </GoldBadge>
                  )}
                </div>

                <div className="flex flex-col gap-[3px]">
                  {isInvited ? (
                    <StatusDot tone="pending">{t('members.status.invited')}</StatusDot>
                  ) : (
                    <StatusDot tone="ok">{t('members.status.active')}</StatusDot>
                  )}
                  <span className="font-mono text-[11px] text-set-fg-subtle">
                    {isInvited && member.invitedAt
                      ? t('members.invited_on', {
                          date: format(new Date(member.invitedAt), 'MMM d, yyyy'),
                        })
                      : member.createdAt
                        ? t('members.joined_on', {
                            date: format(new Date(member.createdAt), 'MMM d, yyyy'),
                          })
                        : t('members.unknown')}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  {isAdmin && (
                    <IconAction
                      icon={Lock}
                      title={t('members.permissions')}
                      active={isExpanded}
                      disabled={isSelf || isMemberOwner}
                      onClick={() => setExpandedId(isExpanded ? null : member.id)}
                    />
                  )}
                  {canRemove && (
                    <IconAction
                      icon={Trash2}
                      tone="danger"
                      title={t('members.remove')}
                      onClick={() => handleRemove(member.id, member.name || member.email)}
                    />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#121214] bg-set-sunken px-[22px] pt-[18px] pb-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-4 pb-3.5">
                    <span className="set-eyebrow tracking-[0.14em]">
                      {t('permissions.granular_access')}
                    </span>
                    <span className="text-[11.5px] text-set-fg-muted">
                      {t('permissions.override_summary', { count: overrides })}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {MODULES.map((mod) => (
                      <div
                        key={mod}
                        className="flex items-center gap-3 rounded-[10px] border border-set-line bg-set-panel px-3.5 py-2.5"
                      >
                        <span className="flex-1 text-[13px] text-set-fg">{mod}</span>
                        <div className="flex items-center gap-1.5">
                          {ACTIONS.map((action) => {
                            const state = readPerm(perms, mod, action);
                            return (
                              <button
                                key={action}
                                type="button"
                                title={t('permissions.cycle_hint', { action, state })}
                                onClick={() => cyclePerm(member, mod, action)}
                                className={cn(
                                  'h-[26px] rounded-md border px-2 text-[11px] font-medium transition-colors',
                                  state === 'allow' &&
                                    'border-set-ok/40 bg-set-ok/15 text-set-ok',
                                  state === 'deny' &&
                                    'border-set-danger/40 bg-set-danger/12 text-set-danger',
                                  state === 'inherit' &&
                                    'border-set-line-strong bg-transparent text-set-fg-subtle hover:text-set-fg'
                                )}
                              >
                                {action}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="pt-3.5 text-[11.5px] text-set-fg-subtle">
                    {t('permissions.description')} {t('permissions.footer')}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <SettingsEmptyState>
            {query ? t('members.no_matches') : t('members.no_members')}
          </SettingsEmptyState>
        )}
        </div>
      </SettingsCard>

      <SettingsCard className="overflow-hidden">
        <SettingsCardHeader icon={Mail} title={t('pending.title')} count={pending.length} />

        {pending.map((member) => (
          <div
            key={`invite-${member.id}`}
            className="grid grid-cols-[1.7fr_120px_1fr_auto] items-center gap-4 border-t border-set-line-soft px-[22px] py-3.5 transition-colors hover:bg-set-row-hover"
          >
            <div className="truncate font-mono text-[12.5px] text-set-fg">{member.email}</div>
            <div className="text-[12.5px] text-set-fg-muted">
              {t(`members.roles.${member.role}` as 'members.roles.member')}
            </div>
            <div className="text-[11.5px] text-set-fg-muted">
              {member.invitedAt
                ? t('pending.sent_on', {
                    date: format(new Date(member.invitedAt), 'MMM d, yyyy'),
                  })
                : ''}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                disabled={!isAdmin}
                onClick={() => handleResend(member.id, member.email)}
              >
                {t('pending.resend')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px] hover:border-set-danger/35 hover:bg-set-danger/12 hover:text-set-danger"
                disabled={!isAdmin}
                onClick={() => handleRemove(member.id, member.email)}
              >
                {t('pending.cancel')}
              </Button>
            </div>
          </div>
        ))}

        {pending.length === 0 && (
          <div className="border-t border-set-line-soft px-[22px] py-7 text-[13px] text-set-fg-muted">
            {t('pending.no_pending')}
          </div>
        )}
      </SettingsCard>

      {dialog}
    </SettingsPage>
  );
}
