from rest_framework import serializers
from .models import User, StudentProfile, TeacherProfile, Booking, Session, Review


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "avatar"]


class TeacherSerializer(serializers.ModelSerializer):
    subjects = serializers.SerializerMethodField()
    levels = serializers.SerializerMethodField()
    mode = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    gender = serializers.SerializerMethodField()
    hourly_rate = serializers.SerializerMethodField()
    languages = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()
    verification_status = serializers.SerializerMethodField()
    rating = serializers.FloatField(source="avg_rating", read_only=True)
    reviews_count = serializers.IntegerField(source="reviews_count", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "avatar",
            "subjects",
            "levels",
            "mode",
            "city",
            "gender",
            "hourly_rate",
            "languages",
            "bio",
            "profile_photo",
            "verification_status",
            "rating",
            "reviews_count",
        ]

    def _profile(self, obj: User) -> TeacherProfile | None:
        return getattr(obj, "teacher_profile", None)

    def get_subjects(self, obj: User):
        return self._profile(obj).subjects if self._profile(obj) else []

    def get_levels(self, obj: User):
        return self._profile(obj).levels if self._profile(obj) else []

    def get_mode(self, obj: User):
        return self._profile(obj).mode if self._profile(obj) else None

    def get_city(self, obj: User):
        return self._profile(obj).city if self._profile(obj) else None

    def get_gender(self, obj: User):
        return self._profile(obj).gender if self._profile(obj) else None

    def get_hourly_rate(self, obj: User):
        return self._profile(obj).hourly_rate if self._profile(obj) else None

    def get_languages(self, obj: User):
        return self._profile(obj).languages if self._profile(obj) else []

    def get_bio(self, obj: User):
        return self._profile(obj).bio if self._profile(obj) else ""

    def get_profile_photo(self, obj: User):
        return self._profile(obj).profile_photo.url if self._profile(obj) and self._profile(obj).profile_photo else None

    def get_verification_status(self, obj: User):
        return self._profile(obj).verification_status if self._profile(obj) else None


class BookingSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "teacher",
            "teacher_name",
            "student",
            "student_name",
            "subject",
            "date",
            "time",
            "status",
            "meet_link",
        ]


class BookingCreateSerializer(serializers.Serializer):
    teacher_id = serializers.IntegerField()
    subject = serializers.CharField(max_length=120)
    date = serializers.DateField()
    time = serializers.TimeField()
    session_type = serializers.CharField(max_length=20, required=False)


class SessionSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="booking.teacher.full_name", read_only=True)
    student_name = serializers.CharField(source="booking.student.full_name", read_only=True)
    subject = serializers.CharField(source="booking.subject", read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "booking",
            "teacher_name",
            "student_name",
            "subject",
            "start_time",
            "duration_minutes",
            "meet_link",
        ]


class ReviewSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "booking",
            "teacher",
            "teacher_name",
            "student",
            "student_name",
            "rating",
            "comment",
            "created_at",
        ]
