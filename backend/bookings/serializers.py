from rest_framework import serializers

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.user.get_full_name", read_only=True)
    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    session_id = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "teacher_id",
            "teacher_name",
            "student_id",
            "student_name",
            "subject",
            "session_type",
            "date",
            "start_time",
            "end_time",
            "status",
            "meet_link",
            "meet_room_id",
            "session_id",
            "price",
            "created_at",
        ]
        read_only_fields = ["meet_link", "meet_room_id", "session_id", "created_at"]

    def get_session_id(self, obj):
        session = getattr(obj, "session", None)
        return session.id if session else None


class BookingCreateSerializer(serializers.Serializer):
    teacher_id = serializers.IntegerField()
    subject = serializers.CharField(max_length=100)
    session_type = serializers.ChoiceField(choices=["trial", "regular"], default="regular")
    date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()

    def validate(self, attrs):
        if attrs["end_time"] <= attrs["start_time"]:
            raise serializers.ValidationError("end_time must be after start_time.")
        return attrs
