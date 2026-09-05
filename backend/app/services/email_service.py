import smtplib
from email.mime.text import MIMEText
from app.core.config import settings

USE_SENDGRID = bool(settings.SENDGRID_API_KEY)


def send_email(to_email: str, subject: str, body: str) -> bool:
    try:
        if USE_SENDGRID:
            return _send_via_sendgrid(to_email, subject, body)
        return _send_via_smtp(to_email, subject, body)
    except Exception:
        return False


def _send_via_sendgrid(to_email: str, subject: str, body: str) -> bool:
    import sendgrid
    from sendgrid.helpers.mail import Mail

    sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    message = Mail(from_email=settings.EMAIL_FROM, to_emails=to_email, subject=subject, plain_text_content=body)
    response = sg.send(message)
    return response.status_code in (200, 201, 202)


def _send_via_smtp(to_email: str, subject: str, body: str) -> bool:
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
    return True


def send_sms(phone_number: str, message: str) -> bool:
    # Stub - integrate with Twilio/MSG91 etc. using settings.SMS_PROVIDER_API_KEY
    if not settings.SMS_PROVIDER_API_KEY:
        return False
    return True
