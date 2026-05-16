from django.db import models


class ClassSession(models.Model):
    booking = models.OneToOneField(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="session",
    )
    meet_link = models.URLField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    student_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Class session"
        verbose_name_plural = "Class sessions"

    def __str__(self):
        return f"Session for booking {self.booking_id}"
