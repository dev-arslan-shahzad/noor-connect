"""Helpers for transactional email tied to authentication."""

from django.conf import settings
from django.core.mail import send_mail


def send_verification_code(user, code):
    """Email a 6-digit verification code to the user.

    In development (SENDGRID_API_KEY blank) Django's console backend prints
    the message to the runserver terminal, which is enough to test the loop.
    """
    subject = "Your NoorConnect verification code"
    body = (
        f"Assalamu alaikum {user.get_full_name()},\n\n"
        f"Your NoorConnect verification code is: {code}\n\n"
        f"This code expires in 15 minutes. If you didn't request this, you "
        f"can safely ignore this email.\n\n"
        f"— NoorConnect"
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
