import logging
import smtplib
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Sends email via SendGrid if configured, else falls back to SMTP.
    Never raises - logs failures so calling flows (registration, password reset) don't break.
    """
    if settings.SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=settings.EMAIL_FROM,
                to_emails=to_email,
                subject=subject,
                html_content=html_content,
            )
            sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
            sg.send(message)
            return True
        except Exception as e:  # noqa
            logger.error(f"SendGrid email failed: {e}")

    if settings.SMTP_HOST:
        try:
            msg = MIMEText(html_content, "html")
            msg["Subject"] = subject
            msg["From"] = settings.EMAIL_FROM
            msg["To"] = to_email
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
            return True
        except Exception as e:  # noqa
            logger.error(f"SMTP email failed: {e}")

    logger.warning(f"No email provider configured. Skipped email to {to_email}: {subject}")
    return False


def send_welcome_email(to_email: str, name: str, temp_password: str | None = None):
    body = f"<p>Hi {name},</p><p>Your account has been created on the AI Learning Platform.</p>"
    if temp_password:
        body += f"<p>Temporary password: <b>{temp_password}</b>. Please change it after first login.</p>"
    send_email(to_email, "Welcome to AI Learning Platform", body)


def send_invite_email(to_email: str, invite_link: str):
    body = f"<p>You have been invited to register on the AI Learning Platform.</p><p><a href='{invite_link}'>Click here to complete your registration</a></p>"
    send_email(to_email, "You're invited - AI Learning Platform", body)


def send_reset_password_email(to_email: str, reset_link: str):
    body = f"<p>We received a request to reset your password.</p><p><a href='{reset_link}'>Click here to reset your password</a>. This link expires in 30 minutes.</p>"
    send_email(to_email, "Reset your password", body)
