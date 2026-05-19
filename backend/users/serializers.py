from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "phone",
            "city",
            "profile_photo",
            "is_learning_for_child",
            "child_name",
            "child_age",
            "is_email_verified",
        ]

    def get_profile_photo(self, obj):
        return obj.profile_photo.url if obj.profile_photo else None


class RegisterSerializer(serializers.Serializer):
    """Register a student or teacher.

    For role=teacher, the serializer also accepts the teacher-profile fields
    (bio, gender, teaching_mode, etc.) and creates a pending TeacherProfile
    in the same transaction. This keeps the application persisted on the
    backend even though the user can't log in until they verify their email.
    """

    # Common fields
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=["student", "teacher"], default="student")

    # Student-only
    is_learning_for_child = serializers.BooleanField(required=False, default=False)
    child_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    child_age = serializers.IntegerField(required=False, allow_null=True)

    # Teacher-only (all optional at the serializer level — we validate below)
    bio = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.CharField(required=False, allow_blank=True)
    teaching_mode = serializers.CharField(required=False, allow_blank=True)
    years_experience = serializers.IntegerField(required=False, default=0)
    hourly_rate = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, default=0
    )
    languages = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    subjects = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    profile_photo = serializers.ImageField(required=False, allow_null=True)
    certificate = serializers.FileField(required=False, allow_null=True)
    cnic = serializers.ImageField(required=False, allow_null=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already in use.")
        return value.lower()

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.get("role", "student")

        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data.get("phone", ""),
            city=validated_data.get("city", ""),
            role=role,
            is_learning_for_child=validated_data.get("is_learning_for_child", False),
            child_name=validated_data.get("child_name", ""),
            child_age=validated_data.get("child_age"),
            is_email_verified=False,
            profile_photo=validated_data.get("profile_photo"),
        )

        if role == "teacher":
            # Import inside the method to avoid a circular import between
            # users.serializers and teachers.models.
            from teachers.models import TeacherProfile

            TeacherProfile.objects.create(
                user=user,
                bio=validated_data.get("bio", ""),
                gender=validated_data.get("gender", ""),
                teaching_mode=validated_data.get("teaching_mode", "both"),
                years_experience=validated_data.get("years_experience", 0),
                hourly_rate=validated_data.get("hourly_rate", 0),
                languages=validated_data.get("languages", []),
                subjects=validated_data.get("subjects", []),
                city=validated_data.get("city", ""),
                certificate=validated_data.get("certificate"),
                cnic=validated_data.get("cnic"),
                verification_status="pending",
            )

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"],
            password=attrs["password"],
        )
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        # NOTE: The "is_email_verified" gate is enforced in LoginView so it can
        # return a structured 403 with a machine-readable code, instead of
        # being collapsed into serializer.errors.
        attrs["user"] = user
        return attrs
