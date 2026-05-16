from django.conf import settings
from django.db import models


class Booking(models.Model):
    STATUS_CHOICES = [
        ("upcoming", "Upcoming"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]
    TYPE_CHOICES = [
        ("trial", "Free Trial"),
        ("regular", "Regular"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    teacher = models.ForeignKey(
        "teachers.TeacherProfile",
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    subject = models.CharField(max_length=100)
    session_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="regular")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="upcoming")
    meet_link = models.URLField(blank=True)
    meet_room_id = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-start_time"]

    def __str__(self):
        return f"{self.student.get_full_name()} → {self.teacher.user.get_full_name()} on {self.date}"
