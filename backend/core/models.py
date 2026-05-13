from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("Email must be set")
        email = self.normalize_email(email)
        username = extra_fields.get("username") or email
        extra_fields["username"] = username
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        TEACHER = "teacher", "Teacher"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    city = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email


class StudentProfile(models.Model):
    class LearnerType(models.TextChoices):
        SELF = "self", "Self"
        CHILD = "child", "Child"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    learner_type = models.CharField(max_length=10, choices=LearnerType.choices, default=LearnerType.SELF)
    child_name = models.CharField(max_length=120, blank=True)
    child_age = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self) -> str:
        return f"StudentProfile({self.user_id})"


class TeacherProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    class TeachingMode(models.TextChoices):
        ONLINE = "online", "Online"
        IN_PERSON = "in-person", "In-person"
        BOTH = "both", "Both"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="teacher_profile")
    gender = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    levels = models.JSONField(default=list, blank=True)
    mode = models.CharField(max_length=20, choices=TeachingMode.choices, default=TeachingMode.ONLINE)
    experience = models.PositiveSmallIntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    languages = models.JSONField(default=list, blank=True)
    bio = models.TextField(blank=True)
    profile_photo = models.ImageField(upload_to="teachers/profile_photos/", blank=True, null=True)
    certificate = models.FileField(upload_to="teachers/certificates/", blank=True, null=True)
    id_doc = models.ImageField(upload_to="teachers/id_docs/", blank=True, null=True)
    intro_video = models.URLField(blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    is_featured = models.BooleanField(default=False)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    def __str__(self) -> str:
        return f"TeacherProfile({self.user_id})"


class Booking(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name="teacher_bookings")
    subject = models.CharField(max_length=120)
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPCOMING)
    meet_link = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Booking({self.id})"


class Session(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="session")
    start_time = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    meet_link = models.URLField(blank=True)

    def __str__(self) -> str:
        return f"Session({self.id})"


class Review(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="review")
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_reviews")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="written_reviews")
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Review({self.id})"
