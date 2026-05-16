from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from teachers.models import TeacherProfile
from users.views import envelope, error_envelope

from .models import Booking
from .permissions import IsBookingParticipant, IsStudent
from .serializers import BookingCreateSerializer, BookingSerializer
from .services.meet_service import create_meet_room
from .tasks import send_booking_cancellation, send_booking_confirmation


class BookingCreateView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_envelope("Validation failed", serializer.errors)
        data = serializer.validated_data

        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            id=data["teacher_id"],
            verification_status="verified",
        )

        with transaction.atomic():
            booking = Booking.objects.create(
                student=request.user,
                teacher=teacher,
                subject=data["subject"],
                session_type=data["session_type"],
                date=data["date"],
                start_time=data["start_time"],
                end_time=data["end_time"],
                price=0 if data["session_type"] == "trial" else teacher.hourly_rate,
            )

            create_meet_room(booking)

            from sessions_app.models import ClassSession
            ClassSession.objects.create(booking=booking, meet_link=booking.meet_link)

        send_booking_confirmation.delay(booking.id)
        return envelope(
            BookingSerializer(booking).data,
            "Booking confirmed!",
            status.HTTP_201_CREATED,
        )


class BookingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == "teacher":
            profile = getattr(user, "teacher_profile", None)
            qs = Booking.objects.filter(teacher=profile) if profile else Booking.objects.none()
        else:
            qs = Booking.objects.filter(student=user)
        qs = qs.select_related("student", "teacher__user").order_by("-date", "-start_time")
        return envelope(BookingSerializer(qs, many=True).data)


class BookingDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBookingParticipant]

    def get(self, request, booking_id):
        booking = get_object_or_404(
            Booking.objects.select_related("student", "teacher__user"),
            id=booking_id,
        )
        self.check_object_permissions(request, booking)
        return envelope(BookingSerializer(booking).data)


class BookingCancelView(APIView):
    permission_classes = [IsAuthenticated, IsBookingParticipant]

    def patch(self, request, booking_id):
        booking = get_object_or_404(
            Booking.objects.select_related("student", "teacher__user"),
            id=booking_id,
        )
        self.check_object_permissions(request, booking)
        if booking.status == "cancelled":
            return error_envelope("Already cancelled", "Booking is already cancelled.")
        booking.status = "cancelled"
        booking.save(update_fields=["status"])
        send_booking_cancellation.delay(booking.id)
        return envelope(BookingSerializer(booking).data, "Booking cancelled")
