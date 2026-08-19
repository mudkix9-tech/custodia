"use client";

/**
 * M110/M111. Work arising from the record, and the conversation about it.
 *
 * Both are attached to the activity rather than living somewhere else, because
 * that is the whole finding: "complete the retention section" is the sentence a DPO
 * says twenty times a week and there was nowhere to put it, and "why is this
 * retention five years?" had nowhere to be asked inside the record it was about.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListChecks, MessageSquare, Plus, Trash2, Check, CornerDownRight, CircleCheck } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { announce } from '@/components/layout/Announcer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** The editor tabs a task can point at, so an assignee lands on the right form. */
const SECTIONS = ['general', 'legal', 'data', 'recipients', 'transfers', 'retention', 'security', 'dpia'] as const;

export function WorkTab({ activityId, orgMembers, currentUserId }: {
  activityId: string;
  orgMembers: { id: string; name?: string | null; email: string }[];
  currentUserId?: string;
}) {
  const t = useTranslations('ropa.work');
  const tabs = useTranslations('ropa.editor.tabs');
  const toast = useToast();
  const utils = trpc.useUtils();

  const date = (value: string | Date | null | undefined) =>
    value ? new Date(value).toLocaleDateString() : '—';

  // --- M110 ----------------------------------------------------------------
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [section, setSection] = useState('');
  const [showDone, setShowDone] = useState(false);

  const { data: tasks = [] } = trpc.ropa.tasks.list.useQuery({ processingActivityId: activityId });

  const refreshTasks = () => utils.ropa.tasks.list.invalidate({ processingActivityId: activityId });

  const createTask = trpc.ropa.tasks.create.useMutation({
    onSuccess: () => {
      setTitle(''); setAssigneeId(''); setDueDate(''); setSection('');
      refreshTasks();
      announce(t('tasks.created'));
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const updateTask = trpc.ropa.tasks.update.useMutation({
    onSuccess: () => refreshTasks(),
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const deleteTask = trpc.ropa.tasks.delete.useMutation({
    onSuccess: () => refreshTasks(),
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });

  const openTasks = (tasks as any[]).filter((task) => task.status !== 'done' && task.status !== 'cancelled');
  const closedTasks = (tasks as any[]).filter((task) => task.status === 'done' || task.status === 'cancelled');

  // --- M111 ----------------------------------------------------------------
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const { data: comments = [] } = trpc.ropa.comments.list.useQuery({ processingActivityId: activityId });
  const refreshComments = () => utils.ropa.comments.list.invalidate({ processingActivityId: activityId });

  const createComment = trpc.ropa.comments.create.useMutation({
    onSuccess: () => { setBody(''); setReplyBody(''); setReplyTo(null); refreshComments(); },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const resolveComment = trpc.ropa.comments.resolve.useMutation({ onSuccess: () => refreshComments() });
  const deleteComment = trpc.ropa.comments.delete.useMutation({ onSuccess: () => refreshComments() });

  const roots = (comments as any[]).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (comments as any[]).filter((c) => c.parentId === id);

  /**
   * Turns a typed `@Name` into the `@[Name](uuid)` the API parses.
   *
   * The id travels in the link and the name in the text, so a mention survives the
   * person changing their name — matching on a bare `@name` would resolve to
   * whoever happens to be called that today, which in a compliance tool means
   * notifying the wrong person about the wrong record.
   */
  const withMentions = (text: string) => {
    let out = text;
    for (const member of orgMembers) {
      const label = member.name || member.email;
      if (!label) continue;
      out = out.split(`@${label}`).join(`@[${label}](${member.id})`);
    }
    return out;
  };

  /** Renders `@[Name](uuid)` back as a highlighted name. */
  const renderBody = (text: string) => {
    const parts = text.split(/(@\[[^\]]*\]\([0-9a-fA-F-]{36}\))/g);
    return parts.map((part, i) => {
      const match = /^@\[([^\]]*)\]\([0-9a-fA-F-]{36}\)$/.exec(part);
      return match
        ? <span key={i} className="rounded bg-[#C9A227]/10 px-1 text-[#C9A227]">@{match[1]}</span>
        : <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <section className="fade-up space-y-5 rounded-2xl bg-[#08090A] p-6 hairline">
        <div className="border-b border-ink-900/8 pb-3">
          <h2 className="flex items-center gap-2 text-[14px] font-medium text-[#F4F5F6]">
            <ListChecks className="h-4 w-4 text-[#C9A227]" /> {t('tasks.title')}
          </h2>
          <p className="mt-1 text-[12px] text-[#6E747A]">{t('tasks.subtitle')}</p>
        </div>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createTask.mutate({
              processingActivityId: activityId,
              title: title.trim(),
              assigneeId: assigneeId || null,
              dueDate: dueDate ? new Date(dueDate) : null,
              section: section || undefined,
            });
          }}
        >
          <div className="min-w-[220px] flex-1 space-y-2">
            <label htmlFor="task-title" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('tasks.what')}</label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tasks.what_ph')} />
          </div>
          <div className="space-y-2">
            <label htmlFor="task-assignee" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('tasks.assignee')}</label>
            <Select value={assigneeId || 'none'} onValueChange={(v) => setAssigneeId(v === 'none' ? '' : v)}>
              <SelectTrigger id="task-assignee" className="w-44"><SelectValue placeholder={t('tasks.unassigned')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('tasks.unassigned')}</SelectItem>
                {orgMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="task-section" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('tasks.section')}</label>
            <Select value={section || 'none'} onValueChange={(v) => setSection(v === 'none' ? '' : v)}>
              <SelectTrigger id="task-section" className="w-40"><SelectValue placeholder={t('tasks.any_section')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('tasks.any_section')}</SelectItem>
                {SECTIONS.map((s) => <SelectItem key={s} value={s}>{tabs(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="task-due" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('tasks.due')}</label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
          </div>
          <Button type="submit" disabled={!title.trim() || createTask.isPending} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> {t('tasks.add')}
          </Button>
        </form>

        {openTasks.length === 0 ? (
          <p className="text-[12.5px] text-[#6E747A]">{t('tasks.none')}</p>
        ) : (
          <ul className="divide-y divide-white/5 border-t border-ink-900/8">
            {openTasks.map((task: any) => {
              const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now();
              return (
                <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => updateTask.mutate({ id: task.id, data: { status: 'done' } })}
                    aria-label={t('tasks.mark_done', { title: task.title })}
                    className="flex h-4 w-4 items-center justify-center rounded border border-white/25 transition-colors hover:border-[#C9A227] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                  >
                    <Check className="h-3 w-3 opacity-0" aria-hidden="true" />
                  </button>
                  <span className="text-[#F4F5F6]">{task.title}</span>
                  {task.section && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-[#9BA1A6]">{tabs(task.section)}</span>}
                  {task.assigneeName || task.assigneeEmail ? (
                    <span className="text-[#9BA1A6]">{task.assigneeName || task.assigneeEmail}</span>
                  ) : (
                    <span className="text-[#6E747A]">{t('tasks.unassigned')}</span>
                  )}
                  {task.dueDate && (
                    <span className={overdue ? 'text-red-400' : 'text-[#6E747A]'}>
                      {overdue ? t('tasks.overdue_on', { date: date(task.dueDate) }) : t('tasks.due_on', { date: date(task.dueDate) })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteTask.mutate({ id: task.id })}
                    aria-label={t('tasks.remove', { title: task.title })}
                    className="ml-auto text-[#6E747A] transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {closedTasks.length > 0 && (
          <div className="border-t border-ink-900/8 pt-3">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="text-[12.5px] text-[#6E747A] transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
            >
              {showDone ? t('tasks.hide_done', { count: closedTasks.length }) : t('tasks.show_done', { count: closedTasks.length })}
            </button>
            {showDone && (
              <ul className="mt-2 divide-y divide-white/5">
                {closedTasks.map((task: any) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-x-3 py-2 text-[12.5px] text-[#6E747A]">
                    <CircleCheck className="h-3.5 w-3.5 text-[#C9A227]" aria-hidden="true" />
                    <span className="line-through">{task.title}</span>
                    <span>{date(task.completedAt)}</span>
                    <button
                      type="button"
                      onClick={() => updateTask.mutate({ id: task.id, data: { status: 'open' } })}
                      className="ml-auto transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                    >
                      {t('tasks.reopen')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="fade-up space-y-5 rounded-2xl bg-[#08090A] p-6 hairline">
        <div className="border-b border-ink-900/8 pb-3">
          <h2 className="flex items-center gap-2 text-[14px] font-medium text-[#F4F5F6]">
            <MessageSquare className="h-4 w-4 text-[#C9A227]" /> {t('comments.title')}
          </h2>
          <p className="mt-1 text-[12px] text-[#6E747A]">{t('comments.subtitle')}</p>
        </div>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            createComment.mutate({ processingActivityId: activityId, body: withMentions(body.trim()) });
          }}
        >
          <label htmlFor="comment-body" className="sr-only">{t('comments.write')}</label>
          <Textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={t('comments.write_ph')} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-[#6E747A]">{t('comments.mention_hint')}</p>
            <Button type="submit" disabled={!body.trim() || createComment.isPending}>{t('comments.post')}</Button>
          </div>
        </form>

        {roots.length === 0 ? (
          <p className="text-[12.5px] text-[#6E747A]">{t('comments.none')}</p>
        ) : (
          <ul className="space-y-4 border-t border-ink-900/8 pt-4">
            {roots.map((comment: any) => (
              <li key={comment.id} className="space-y-2">
                <div className={`rounded-xl border p-3 ${comment.resolvedAt ? 'border-white/5 bg-white/[0.02] opacity-70' : 'border-white/10 bg-[#0D0F11]'}`}>
                  <div className="flex flex-wrap items-baseline gap-2 text-[12px]">
                    <span className="font-medium text-[#E6E8EA]">{comment.authorName || comment.authorEmail}</span>
                    <span className="text-[#6E747A]">{date(comment.createdAt)}</span>
                    {comment.field && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-[#9BA1A6]">{comment.field}</span>}
                    {comment.resolvedAt && <span className="text-[11px] text-[#C9A227]">{t('comments.resolved')}</span>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[#F4F5F6]">{renderBody(comment.body)}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      className="inline-flex items-center gap-1 text-[#6E747A] transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                    >
                      <CornerDownRight className="h-3 w-3" aria-hidden="true" /> {t('comments.reply')}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveComment.mutate({ id: comment.id, resolved: !comment.resolvedAt })}
                      className="text-[#6E747A] transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                    >
                      {comment.resolvedAt ? t('comments.reopen') : t('comments.resolve')}
                    </button>
                    {/* Only your own, and soft — a thread with a hole in it reads as
                        tampering in an audit context. */}
                    {comment.authorId === currentUserId && (
                      <button
                        type="button"
                        onClick={() => deleteComment.mutate({ id: comment.id })}
                        className="text-[#6E747A] transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                      >
                        {t('comments.delete')}
                      </button>
                    )}
                  </div>
                </div>

                {repliesOf(comment.id).length > 0 && (
                  <ul className="ml-6 space-y-2 border-l border-white/10 pl-4">
                    {repliesOf(comment.id).map((reply: any) => (
                      <li key={reply.id} className="text-[12.5px]">
                        <div className="flex flex-wrap items-baseline gap-2 text-[12px]">
                          <span className="font-medium text-[#E6E8EA]">{reply.authorName || reply.authorEmail}</span>
                          <span className="text-[#6E747A]">{date(reply.createdAt)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-[#9BA1A6]">{renderBody(reply.body)}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {replyTo === comment.id && (
                  <form
                    className="ml-6 space-y-2 border-l border-white/10 pl-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!replyBody.trim()) return;
                      createComment.mutate({
                        processingActivityId: activityId,
                        parentId: comment.id,
                        body: withMentions(replyBody.trim()),
                      });
                    }}
                  >
                    <label htmlFor={`reply-${comment.id}`} className="sr-only">{t('comments.reply')}</label>
                    <Textarea
                      id={`reply-${comment.id}`}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={2}
                      placeholder={t('comments.reply_ph')}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={!replyBody.trim() || createComment.isPending}>{t('comments.post')}</Button>
                      <Button type="button" variant="ghost" onClick={() => { setReplyTo(null); setReplyBody(''); }}>
                        {t('comments.cancel')}
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
