from rest_framework import serializers

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    student_photo = serializers.SerializerMethodField()
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "booking",
            "teacher_id",
            "student",
            "student_name",
            "student_photo",
            "rating",
            "comment",
            "created_at",
        ]
        read_only_fields = ["student", "teacher_id", "created_at"]

    def get_student_photo(self, obj):
        photo = getattr(obj.student, "profile_photo", None)
        return photo.url if photo else None


class ReviewCreateSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(allow_blank=True, required=False, default="")
