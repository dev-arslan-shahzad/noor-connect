from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def send_teacher_application_received(teacher_profile_id):
    from .models import TeacherProfile

    teacher = TeacherProfile.objects.select_related("user").filter(id=teacher_profile_id).first()
    if not teacher:
        return
    send_mail(
        subject="NoorConnect — Application received",
        message=(
            f"Salam {teacher.user.get_full_name()},\n\n"
            "We've received your teacher application. Our team will review your "
            "credentials within 24-48 hours and email you the result."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[teacher.user.email],
        fail_silently=True,
    )


@shared_task
def send_teacher_verification_result(teacher_profile_id, verification_status, reason=""):
    from .models import TeacherProfile

    teacher = TeacherProfile.objects.select_related("user").filter(id=teacher_profile_id).first()
    if not teacher:
        return

    if verification_status == "verified":
        body = (
            "Congratulations! Your NoorConnect teacher profile has been verified. "
            "Students can now find and book you."
        )
    else:
        body = f"Your NoorConnect application was not approved. Reason: {reason or 'N/A'}"

    send_mail(
        subject="NoorConnect — Teacher verification update",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[teacher.user.email],
        fail_silently=True,
    )
