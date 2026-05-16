from django.contrib.auth import authenticate
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
        ]

    def get_profile_photo(self, obj):
        return obj.profile_photo.url if obj.profile_photo else None


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=["student", "teacher"], default="student")
    is_learning_for_child = serializers.BooleanField(required=False, default=False)
    child_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    child_age = serializers.IntegerField(required=False, allow_null=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already in use.")
        return value.lower()

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data.get("phone", ""),
            city=validated_data.get("city", ""),
            role=validated_data.get("role", "student"),
            is_learning_for_child=validated_data.get("is_learning_for_child", False),
            child_name=validated_data.get("child_name", ""),
            child_age=validated_data.get("child_age"),
        )


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
        attrs["user"] = user
        return attrs
