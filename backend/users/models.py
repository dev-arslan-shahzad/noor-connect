import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email must be set")
        email = self.normalize_email(email)
        extra_fields.setdefault("username", email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    ROLE_CHOICES = [
        ("student", "Student"),
        ("teacher", "Teacher"),
        ("admin", "Admin"),
    ]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="student")
    phone = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    profile_photo = models.ImageField(upload_to="profiles/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    is_learning_for_child = models.BooleanField(default=False)
    child_name = models.CharField(max_length=100, blank=True)
    child_age = models.IntegerField(null=True, blank=True)

    is_email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    def get_full_name(self):
        return self.full_name or super().get_full_name() or self.email

    def __str__(self):
        return self.email


class EmailVerificationCode(models.Model):
    """A short-lived 6-digit code emailed to a user to verify their address."""

    CODE_TTL = timedelta(minutes=15)
    RESEND_COOLDOWN = timedelta(seconds=60)
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="email_codes"
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["user", "used_at"])]
        ordering = ["-created_at"]

    @classmethod
    def generate_for(cls, user):
        # Invalidate any earlier unused codes so only the latest is valid.
        cls.objects.filter(user=user, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        return cls.objects.create(
            user=user,
            code=f"{secrets.randbelow(1_000_000):06d}",
            expires_at=timezone.now() + cls.CODE_TTL,
        )

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"{self.user.email} code (used={self.used_at is not None})"
