"use server";

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactMessage(formData: FormData) {
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  if (!firstName || !lastName || !email || !message) {
    return { success: false, error: 'All fields are required.' };
  }

  const contactEmail = process.env.CONTACT_EMAIL;
  if (!contactEmail) {
    throw new Error("CONTACT_EMAIL not configured");
  }

  try {
    const { error } = await resend.emails.send({
      from: 'notifications@trycustodia.online',
      to: contactEmail,
      reply_to: email,
      subject: `New Contact Request from ${firstName} ${lastName}`,
      html: `
        <h2>New Contact Request</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
      `,
    });

    if (error) {
      console.error('Error sending contact email via Resend:', error);
      return { success: false, error: 'Failed to send message. Please try again later.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in sendContactMessage:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
