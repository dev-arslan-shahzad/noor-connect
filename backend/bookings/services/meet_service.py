import logging
import os
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)


def _build_meet_service():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        token_uri="https://oauth2.googleapis.com/token",
    )
    return build("meet", "v2", credentials=creds, cache_discovery=False)


def create_meet_room(booking):
    if not all([os.getenv("GOOGLE_CLIENT_ID"), os.getenv("GOOGLE_CLIENT_SECRET"), os.getenv("GOOGLE_REFRESH_TOKEN")]):
        fallback_id = uuid.uuid4().hex[:10]
        fallback_link = f"https://meet.google.com/lookup/{fallback_id}"
        logger.warning(
            "Google Meet credentials missing — using placeholder link %s for booking %s",
            fallback_link, booking.id,
        )
        booking.meet_link = fallback_link
        booking.meet_room_id = f"placeholder-{fallback_id}"
        booking.save(update_fields=["meet_link", "meet_room_id"])
        return fallback_link

    try:
        service = _build_meet_service()
        space = service.spaces().create(body={}).execute()
        booking.meet_link = space.get("meetingUri", "")
        booking.meet_room_id = space.get("name", "")
        booking.save(update_fields=["meet_link", "meet_room_id"])
        return booking.meet_link
    except Exception as exc:
        logger.exception("Google Meet room creation failed for booking %s: %s", booking.id, exc)
        fallback_id = uuid.uuid4().hex[:10]
        booking.meet_link = f"https://meet.google.com/lookup/{fallback_id}"
        booking.meet_room_id = f"error-{fallback_id}"
        booking.save(update_fields=["meet_link", "meet_room_id"])
        return booking.meet_link
