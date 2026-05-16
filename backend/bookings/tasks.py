from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def send_booking_confirmation(booking_id):
    from .models import Booking

    booking = (
        Booking.objects.select_related("student", "teacher__user")
        .filter(id=booking_id)
        .first()
    )
    if not booking:
        return

    student_msg = (
        f"Salam {booking.student.get_full_name()},\n\n"
        f"Your session with {booking.teacher.user.get_full_name()} is confirmed.\n"
        f"Date: {booking.date}\n"
        f"Time: {booking.start_time} – {booking.end_time}\n"
        f"Subject: {booking.subject}\n"
        f"Join here: {booking.meet_link or 'Link will be available shortly.'}\n"
    )
    send_mail(
        subject="Your NoorConnect session is confirmed!",
        message=student_msg,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.student.email],
        fail_silently=True,
    )

    teacher_msg = (
        f"Salam {booking.teacher.user.get_full_name()},\n\n"
        f"{booking.student.get_full_name()} booked a session.\n"
        f"Date: {booking.date}\n"
        f"Time: {booking.start_time} – {booking.end_time}\n"
        f"Subject: {booking.subject}\n"
        f"Join here: {booking.meet_link or 'Link will be available shortly.'}\n"
    )
    send_mail(
        subject="New session booked on NoorConnect",
        message=teacher_msg,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.teacher.user.email],
        fail_silently=True,
    )


@shared_task
def send_booking_cancellation(booking_id):
    from .models import Booking

    booking = (
        Booking.objects.select_related("student", "teacher__user")
        .filter(id=booking_id)
        .first()
    )
    if not booking:
        return

    body = (
        f"Booking on {booking.date} at {booking.start_time} has been cancelled."
    )
    send_mail(
        subject="NoorConnect — Booking cancelled",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.student.email, booking.teacher.user.email],
        fail_silently=True,
    )
