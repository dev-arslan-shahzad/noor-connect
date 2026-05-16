from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg


class Review(models.Model):
    booking = models.OneToOneField(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="review",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_written",
    )
    teacher = models.ForeignKey(
        "teachers.TeacherProfile",
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review {self.id} ({self.rating}/5)"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        agg = Review.objects.filter(teacher=self.teacher).aggregate(avg=Avg("rating"), count=models.Count("id"))
        self.teacher.average_rating = round(agg["avg"] or 0.0, 2)
        self.teacher.total_reviews = agg["count"] or 0
        self.teacher.save(update_fields=["average_rating", "total_reviews"])
