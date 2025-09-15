type Env = {
  RESEND_API_KEY?: string
  APP_URL?: string
  FROM_EMAIL?: string
}

export const sendEmail = async (env: Env, to: string, subject: string, content: string) => {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email')
    return
  }

  // Use configured FROM_EMAIL or default to notifications.entente.dev
  const fromEmail = env.FROM_EMAIL || 'Entente <noreply@notifications.entente.dev>'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html: content
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Resend API error response:', errorText)
      throw new Error(`Email API error: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.error('Email sending failed:', error)
    throw error
  }
}

export const createInvitationEmailTemplate = (
  tenantName: string,
  inviterName: string,
  inviteUrl: string
) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">You've been invited to join ${tenantName}</h2>

      <p>Hi there!</p>

      <p>${inviterName} has invited you to join <strong>${tenantName}</strong> on Entente.</p>

      <p>To accept this invitation and join the team, simply click the link below:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}"
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Accept Invitation
        </a>
      </div>

      <p>Or copy and paste this link into your browser:</p>
      <p style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; word-break: break-all;">
        ${inviteUrl}
      </p>

      <p>If you didn't expect this invitation, you can safely ignore this email.</p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

      <p style="color: #666; font-size: 14px;">
        This invitation was sent from Entente. If you have any questions, please contact support.
      </p>
    </div>
  `
}