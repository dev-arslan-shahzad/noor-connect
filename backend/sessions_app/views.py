from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from bookings.permissions import IsBookingParticipant
from users.views import envelope, error_envelope

from .models import ClassSession
from .serializers import SessionSerializer
from .services.agora_service import build_rtc_token


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


class SessionPreviewTokenView(APIView):
    """Issue an Agora token for a public 'lobby/preview' channel so users can
    verify their camera & mic in a real Agora call without needing a booking.

    The channel is per-user so two preview windows on different accounts won't
    talk to each other accidentally.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services.agora_service import (
            ROLE_PUBLISHER,
            _AccessToken,
            _agora_credentials,
        )
        import time as _time

        app_id, app_cert = _agora_credentials()
        channel = f"noor-preview-{request.user.id}"
        uid = request.user.id
        expire_ts = int(_time.time()) + 60 * 30  # 30-minute test window

        if not app_id or not app_cert:
            payload = {
                "app_id": app_id,
                "channel": channel,
                "uid": uid,
                "token": "",
                "role": "publisher",
                "expires_at": expire_ts,
                "configured": False,
            }
        else:
            access = _AccessToken(app_id, app_cert, channel, str(uid))
            access.add_privilege(1, expire_ts)  # join channel
            access.add_privilege(2, expire_ts)  # publish audio
            access.add_privilege(3, expire_ts)  # publish video
            access.add_privilege(4, expire_ts)  # publish data
            payload = {
                "app_id": app_id,
                "channel": channel,
                "uid": uid,
                "token": access.build(),
                "role": "publisher",
                "expires_at": expire_ts,
                "configured": True,
            }
        payload["display_name"] = (
            request.user.get_full_name() or getattr(request.user, "email", "User")
        )
        return envelope(payload)


class SessionAgoraTokenView(APIView):
    """Issue a short-lived Agora RTC token for a session participant.

    Both the student and the teacher join as publishers so audio/video flows
    bidirectionally. Tokens expire after ~2h or the booking's end-time + 30 min,
    whichever is shorter — but not less than 15 min to allow brief reconnects.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(
            ClassSession.objects.select_related(
                "booking__student", "booking__teacher__user"
            ),
            id=session_id,
        )
        if not _is_participant(session, request.user):
            return error_envelope(
                "Not allowed", "You are not a participant of this session.", 403
            )
        if session.booking.status == "cancelled":
            return error_envelope(
                "Booking cancelled",
                "Cannot join a cancelled session.",
                403,
            )

        # Decide token lifetime: until 30 minutes after the booked end-time,
        # capped at 2 hours and floored at 15 minutes.
        import datetime as _dt

        now = timezone.now()
        end_dt = _dt.datetime.combine(session.booking.date, session.booking.end_time)
        if timezone.is_naive(end_dt):
            end_dt = timezone.make_aware(end_dt, timezone.get_current_timezone())
        seconds_until_end = max(0, int((end_dt - now).total_seconds())) + 30 * 60
        expire_seconds = max(15 * 60, min(2 * 3600, seconds_until_end))

        payload = build_rtc_token(session, request.user, role="publisher",
                                   expire_seconds=expire_seconds)
        # Augment with display info so the client can render participant tiles
        # without an extra round-trip.
        payload["display_name"] = (
            request.user.get_full_name() or getattr(request.user, "email", "User")
        )
        payload["role_in_session"] = (
            "teacher" if getattr(request.user, "role", "") == "teacher" else "student"
        )
        payload["session_id"] = session.id
        return envelope(payload)
