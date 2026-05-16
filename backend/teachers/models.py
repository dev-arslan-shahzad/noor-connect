from django.conf import settings
from django.db import models


class TeacherProfile(models.Model):
    VERIFICATION_STATUS = [
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
    ]
    GENDER_CHOICES = [("male", "Male"), ("female", "Female")]
    MODE_CHOICES = [
        ("online", "Online"),
        ("inperson", "In-person"),
        ("both", "Both"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
    )
    bio = models.TextField(blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    teaching_mode = models.CharField(max_length=10, choices=MODE_CHOICES, default="both")
    years_experience = models.IntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    languages = models.JSONField(default=list, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    city = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    certificate = models.FileField(upload_to="certificates/", blank=True, null=True)
    cnic = models.ImageField(upload_to="cnic/", blank=True, null=True)
    verification_status = models.CharField(
        max_length=10, choices=VERIFICATION_STATUS, default="pending"
    )
    rejection_reason = models.TextField(blank=True)
    is_featured = models.BooleanField(default=False)
    average_rating = models.FloatField(default=0.0)
    total_reviews = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_featured", "-average_rating", "-created_at"]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.verification_status}"
