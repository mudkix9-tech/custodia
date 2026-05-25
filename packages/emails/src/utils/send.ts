import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

type SendEmailParams = {
  to: string | string[];
  subject: string;
  template: React.ReactElement;
  from?: string;          // override for white-labeled emails
  replyTo?: string;       // for DSAR emails, reply goes to the org
  tags?: Record<string, string>;  // for Resend analytics
};

export async function sendEmail({ to, subject, template, from, replyTo, tags }: SendEmailParams) {
  const html = await render(template);

  const result = await resend.emails.send({
    from: from || 'Privaro <notifications@privaro.io>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo: replyTo,
    tags: tags ? Object.entries(tags).map(([name, value]) => ({ name, value })) : undefined,
  });

  return result;
}
