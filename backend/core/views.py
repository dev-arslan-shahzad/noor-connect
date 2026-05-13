from datetime import datetime
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, StudentProfile, TeacherProfile, Booking, Session, Review
from .serializers import (
    UserSerializer,
    TeacherSerializer,
    BookingSerializer,
    BookingCreateSerializer,
    SessionSerializer,
    ReviewSerializer,
)
from .permissions import IsStudent, IsTeacher, IsSelfTeacher


def success_response(data=None, message="OK", status_code=status.HTTP_200_OK):
    return Response({"status": "success", "message": message, "data": data}, status=status_code)


def error_response(detail, error="error", status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": error, "detail": detail}, status=status_code)


def parse_list(value):
    if isinstance(value, list):
        return [v for v in value if v]
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        email = data.get("email")
        password = data.get("password")
        role = data.get("role", "student")
        if not email or not password:
            return error_response("Email and password are required.")
        if role not in ("student", "teacher"):
            return error_response("Invalid role.")
        if User.objects.filter(email=email).exists():
            return error_response("Email already in use.")

        user = User.objects.create_user(
            email=email,
            password=password,
            role=role,
            full_name=data.get("full_name", ""),
            phone=data.get("phone", ""),
            city=data.get("city", ""),
        )

        if role == "student":
            StudentProfile.objects.create(
                user=user,
                learner_type=data.get("learner_type", "self"),
                child_name=data.get("child_name", ""),
                child_age=data.get("child_age") or None,
            )
        else:
            TeacherProfile.objects.create(user=user, city=user.city, gender=data.get("gender", ""))

        refresh = RefreshToken.for_user(user)
        payload = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
        return success_response(payload, "Registered", status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        if not email or not password:
            return error_response("Email and password are required.")
        user = authenticate(request, username=email, password=password)
        if not user:
            return error_response("Invalid credentials.", status_code=status.HTTP_401_UNAUTHORIZED)
        refresh = RefreshToken.for_user(user)
        payload = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
        return success_response(payload, "Logged in")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return error_response("Refresh token is required.")
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return success_response(message="Logged out")
        except Exception:
            return error_response("Invalid refresh token.")


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(UserSerializer(request.user).data)


class TeacherListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            User.objects.filter(role="teacher", teacher_profile__verification_status="verified")
            .select_related("teacher_profile")
            .annotate(avg_rating=Avg("received_reviews__rating"), reviews_count=Count("received_reviews"))
        )

        subject = request.query_params.get("subject")
        gender = request.query_params.get("gender")
        mode = request.query_params.get("mode")
        city = request.query_params.get("city")
        min_price = request.query_params.get("min_price")
        max_price = request.query_params.get("max_price")
        rating = request.query_params.get("rating")
        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")
        featured = request.query_params.get("featured")

        if subject:
            qs = qs.filter(teacher_profile__subjects__contains=[subject])
        if gender and gender != "any":
            qs = qs.filter(teacher_profile__gender__iexact=gender)
        if mode and mode != "any":
            qs = qs.filter(teacher_profile__mode=mode)
        if city:
            qs = qs.filter(teacher_profile__city__iexact=city)
        if min_price:
            qs = qs.filter(teacher_profile__hourly_rate__gte=min_price)
        if max_price:
            qs = qs.filter(teacher_profile__hourly_rate__lte=max_price)
        if rating:
            try:
                qs = qs.filter(avg_rating__gte=float(rating))
            except ValueError:
                pass
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(teacher_profile__bio__icontains=search))
        if featured in ("true", "1", "yes"):
            qs = qs.filter(teacher_profile__is_featured=True)

        ordering_map = {
            "highest_rated": "-avg_rating",
            "lowest_price": "teacher_profile__hourly_rate",
            "most_reviews": "-reviews_count",
        }
        if ordering:
            qs = qs.order_by(ordering_map.get(ordering, ordering))

        data = TeacherSerializer(qs, many=True).data
        return success_response(data)


class TeacherDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, teacher_id: int):
        teacher = get_object_or_404(
            User.objects.select_related("teacher_profile")
            .annotate(avg_rating=Avg("received_reviews__rating"), reviews_count=Count("received_reviews")),
            id=teacher_id,
            role="teacher",
        )
        return success_response(TeacherSerializer(teacher).data)


class TeacherApplyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return error_response("Email and password are required.")
        if User.objects.filter(email=email).exists():
            return error_response("Email already in use.")

        user = User.objects.create_user(
            email=email,
            password=password,
            role="teacher",
            full_name=data.get("full_name", ""),
            phone=data.get("phone", ""),
            city=data.get("city", ""),
        )

        profile = TeacherProfile.objects.create(
            user=user,
            gender=data.get("gender", ""),
            city=data.get("city", ""),
            subjects=parse_list(data.get("subjects")),
            levels=parse_list(data.get("levels")),
            mode=data.get("mode", TeacherProfile.TeachingMode.ONLINE),
            experience=int(data.get("experience") or 0),
            hourly_rate=data.get("hourly_rate") or 0,
            languages=parse_list(data.get("languages")),
            bio=data.get("bio", ""),
            profile_photo=data.get("profile_photo"),
            certificate=data.get("certificate"),
            id_doc=data.get("id_doc"),
            intro_video=data.get("intro_video", ""),
        )

        payload = {"teacher_id": profile.user_id}
        return success_response(payload, "Application submitted", status.HTTP_201_CREATED)


class TeacherUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsSelfTeacher]

    def patch(self, request, teacher_id: int):
        user = request.user
        profile = getattr(user, "teacher_profile", None)
        if not profile:
            return error_response("Teacher profile not found.", status_code=status.HTTP_404_NOT_FOUND)

        data = request.data
        user.full_name = data.get("full_name", user.full_name)
        user.phone = data.get("phone", user.phone)
        user.city = data.get("city", user.city)
        if data.get("avatar"):
            user.avatar = data.get("avatar")
        user.save()

        profile.subjects = parse_list(data.get("subjects")) or profile.subjects
        profile.levels = parse_list(data.get("levels")) or profile.levels
        profile.mode = data.get("mode", profile.mode)
        profile.experience = data.get("experience", profile.experience)
        profile.hourly_rate = data.get("hourly_rate", profile.hourly_rate)
        profile.languages = parse_list(data.get("languages")) or profile.languages
        profile.bio = data.get("bio", profile.bio)
        profile.gender = data.get("gender", profile.gender)
        profile.city = data.get("city", profile.city)
        if data.get("profile_photo"):
            profile.profile_photo = data.get("profile_photo")
        profile.save()

        return success_response(TeacherSerializer(user).data, "Profile updated")


class NearbyTeachersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            User.objects.filter(role="teacher", teacher_profile__verification_status="verified")
            .select_related("teacher_profile")
            .annotate(avg_rating=Avg("received_reviews__rating"), reviews_count=Count("received_reviews"))
        )

        subject = request.query_params.get("subject")
        gender = request.query_params.get("gender")
        city = request.query_params.get("city")

        if subject:
            qs = qs.filter(teacher_profile__subjects__contains=[subject])
        if gender and gender != "any":
            qs = qs.filter(teacher_profile__gender__iexact=gender)
        if city:
            qs = qs.filter(teacher_profile__city__iexact=city)

        data = TeacherSerializer(qs, many=True).data
        return success_response(data)


class BookingCreateView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(serializer.errors)
        data = serializer.validated_data
        teacher = get_object_or_404(User, id=data["teacher_id"], role="teacher")

        booking = Booking.objects.create(
            student=request.user,
            teacher=teacher,
            subject=data["subject"],
            date=data["date"],
            time=data["time"],
        )

        start_time = datetime.combine(data["date"], data["time"])
        if timezone.is_naive(start_time):
            start_time = timezone.make_aware(start_time)
        Session.objects.create(booking=booking, start_time=start_time, meet_link="")

        return success_response(BookingSerializer(booking).data, "Booking created", status.HTTP_201_CREATED)


class BookingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == "teacher":
            qs = Booking.objects.filter(teacher=request.user)
        else:
            qs = Booking.objects.filter(student=request.user)
        data = BookingSerializer(qs.order_by("-created_at"), many=True).data
        return success_response(data)


class BookingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)
        if booking.student_id != request.user.id and booking.teacher_id != request.user.id:
            return error_response("Not allowed.", status_code=status.HTTP_403_FORBIDDEN)
        return success_response(BookingSerializer(booking).data)


class BookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)
        if booking.student_id != request.user.id and booking.teacher_id != request.user.id:
            return error_response("Not allowed.", status_code=status.HTTP_403_FORBIDDEN)
        booking.status = Booking.Status.CANCELLED
        booking.save()
        return success_response(BookingSerializer(booking).data, "Booking cancelled")


class SessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == "teacher":
            qs = Session.objects.filter(booking__teacher=request.user)
        else:
            qs = Session.objects.filter(booking__student=request.user)
        data = SessionSerializer(qs.order_by("-start_time"), many=True).data
        return success_response(data)


class SessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id: int):
        session = get_object_or_404(Session, id=session_id)
        booking = session.booking
        if booking.student_id != request.user.id and booking.teacher_id != request.user.id:
            return error_response("Not allowed.", status_code=status.HTTP_403_FORBIDDEN)
        return success_response(SessionSerializer(session).data)


class ReviewView(APIView):
    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [IsAuthenticated(), IsStudent()]
        return [AllowAny()]

    def get(self, request):
        teacher_id = request.query_params.get("teacher")
        qs = Review.objects.all()
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        data = ReviewSerializer(qs.order_by("-created_at"), many=True).data
        return success_response(data)

    def post(self, request):
        booking_id = request.data.get("booking")
        rating = request.data.get("rating")
        comment = request.data.get("comment", "")
        if not booking_id or not rating:
            return error_response("Booking and rating are required.")

        booking = get_object_or_404(Booking, id=booking_id)
        if booking.student_id != request.user.id:
            return error_response("Not allowed.", status_code=status.HTTP_403_FORBIDDEN)
        if Review.objects.filter(booking=booking).exists():
            return error_response("Review already submitted.")

        review = Review.objects.create(
            booking=booking,
            teacher=booking.teacher,
            student=request.user,
            rating=int(rating),
            comment=comment,
        )
        return success_response(ReviewSerializer(review).data, "Review submitted", status.HTTP_201_CREATED)
