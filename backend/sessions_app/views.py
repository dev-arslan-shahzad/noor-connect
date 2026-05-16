from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from bookings.permissions import IsBookingParticipant
from users.views import envelope, error_envelope

from .models import ClassSession
from .serializers import SessionSerializer


def _is_participant(session, user):
    booking = session.booking
    if booking.student_id == user.id:
        return True
    teacher_user_id = getattr(booking.teacher, "user_id", None)
    return teacher_user_id == user.id


class SessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = ClassSession.objects.select_related(
            "booking__student", "booking__teacher__user"
        )
        if user.role == "teacher":
            profile = getattr(user, "teacher_profile", None)
            qs = qs.filter(booking__teacher=profile) if profile else qs.none()
        else:
            qs = qs.filter(booking__student=user)
        qs = qs.order_by("-booking__date", "-booking__start_time")
        return envelope(SessionSerializer(qs, many=True).data)


class SessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(
            ClassSession.objects.select_related(
                "booking__student", "booking__teacher__user"
            ),
            id=session_id,
        )
        if not _is_participant(session, request.user):
            return error_envelope("Not allowed", "You are not a participant of this session.", 403)
        return envelope(SessionSerializer(session).data)


class SessionStartView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, session_id):
        session = get_object_or_404(
            ClassSession.objects.select_related("booking__teacher"), id=session_id
        )
        if not _is_participant(session, request.user):
            return error_envelope(
                "Not allowed", "You are not a participant of this session.", 403
            )
        if session.booking.status == "cancelled":
            return error_envelope(
                "Booking cancelled",
                "Cannot start a session for a cancelled booking.",
            )
        if session.booking.status == "completed":
            return error_envelope(
                "Already completed",
                "This booking has already been completed.",
            )
        if not session.started_at:
            session.started_at = timezone.now()
        session.is_active = True
        session.save(update_fields=["started_at", "is_active"])
        return envelope(SessionSerializer(session).data, "Session started")


class SessionEndView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, session_id):
        session = get_object_or_404(
            ClassSession.objects.select_related("booking__teacher"), id=session_id
        )
        if not _is_participant(session, request.user):
            return error_envelope(
                "Not allowed", "You are not a participant of this session.", 403
            )
        if session.booking.status == "cancelled":
            return error_envelope(
                "Booking cancelled",
                "Cannot end a session for a cancelled booking.",
            )
        if not session.started_at:
            return error_envelope(
                "Session not started",
                "Start the session before ending it.",
            )
        session.ended_at = timezone.now()
        session.is_active = False
        notes = request.data.get("student_notes")
        if notes is not None:
            session.student_notes = notes
        # Only flip to completed if the booking is still in-flight ("upcoming").
        if session.booking.status == "upcoming":
            session.booking.status = "completed"
            session.booking.save(update_fields=["status"])
        session.save(update_fields=["ended_at", "is_active", "student_notes"])
        return envelope(SessionSerializer(session).data, "Session ended")
