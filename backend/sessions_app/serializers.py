from rest_framework import serializers

from .models import ClassSession


class SessionSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)
    subject = serializers.CharField(source="booking.subject", read_only=True)
    date = serializers.DateField(source="booking.date", read_only=True)
    start_time = serializers.TimeField(source="booking.start_time", read_only=True)
    end_time = serializers.TimeField(source="booking.end_time", read_only=True)
    status = serializers.CharField(source="booking.status", read_only=True)
    teacher_name = serializers.CharField(source="booking.teacher.user.get_full_name", read_only=True)
    teacher_id = serializers.IntegerField(source="booking.teacher.id", read_only=True)
    student_name = serializers.CharField(source="booking.student.get_full_name", read_only=True)
    student_id = serializers.IntegerField(source="booking.student.id", read_only=True)

    class Meta:
        model = ClassSession
        fields = [
            "id",
            "booking_id",
            "subject",
            "date",
            "start_time",
            "end_time",
            "status",
            "teacher_id",
            "teacher_name",
            "student_id",
            "student_name",
            "meet_link",
            "started_at",
            "ended_at",
            "student_notes",
            "is_active",
        ]
