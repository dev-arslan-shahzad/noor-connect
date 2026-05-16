from rest_framework import serializers

from users.serializers import UserSerializer

from .models import TeacherProfile


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TeacherProfile
        fields = [
            "id",
            "user",
            "bio",
            "gender",
            "teaching_mode",
            "years_experience",
            "hourly_rate",
            "languages",
            "subjects",
            "city",
            "latitude",
            "longitude",
            "verification_status",
            "is_featured",
            "average_rating",
            "total_reviews",
            "created_at",
        ]


class TeacherDetailSerializer(TeacherSerializer):
    reviews = serializers.SerializerMethodField()

    class Meta(TeacherSerializer.Meta):
        fields = TeacherSerializer.Meta.fields + ["reviews"]

    def get_reviews(self, obj):
        from reviews.serializers import ReviewSerializer
        return ReviewSerializer(obj.reviews.select_related("student").all(), many=True).data


class TeacherApplySerializer(serializers.ModelSerializer):
    languages = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    subjects = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    class Meta:
        model = TeacherProfile
        fields = [
            "bio",
            "gender",
            "teaching_mode",
            "years_experience",
            "hourly_rate",
            "languages",
            "subjects",
            "city",
            "latitude",
            "longitude",
            "certificate",
            "cnic",
        ]

    def to_internal_value(self, data):
        # form-data sends repeated keys (subjects=Tajweed, subjects=Hifz, ...).
        # data.get() returns only the LAST value — we need data.getlist().
        # Also accept a single comma-separated string as a convenience.
        if hasattr(data, "getlist"):
            data = data.copy()
            for key in ("languages", "subjects"):
                values = data.getlist(key)
                if len(values) == 1 and isinstance(values[0], str) and "," in values[0]:
                    data.setlist(
                        key, [v.strip() for v in values[0].split(",") if v.strip()]
                    )
        return super().to_internal_value(data)


class TeacherUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        fields = [
            "bio",
            "gender",
            "teaching_mode",
            "years_experience",
            "hourly_rate",
            "languages",
            "subjects",
            "city",
            "latitude",
            "longitude",
            "certificate",
            "cnic",
        ]
        extra_kwargs = {field: {"required": False} for field in fields}
