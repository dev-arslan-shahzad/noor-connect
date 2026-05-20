"""
Agora RTC token generation.

Implements the AccessToken (RtcTokenBuilder) algorithm so we don't depend on a
PyPI package being available. This is the same algorithm used by Agora's
official `agora-token-builder` package and is documented at:
    https://docs.agora.io/en/video-calling/get-started/authentication-workflow

Usage:
    token, channel, uid = build_rtc_token(session, user, role="publisher",
                                          expire_seconds=3600)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import struct
import time
import zlib
from io import BytesIO

from django.conf import settings

logger = logging.getLogger(__name__)


# ---- Role constants (mirror Agora SDK) ----
ROLE_PUBLISHER = 1   # full audio/video send + receive
ROLE_SUBSCRIBER = 2  # receive only

# Privilege IDs from Agora's AccessToken spec
_PRIV_JOIN_CHANNEL = 1
_PRIV_PUBLISH_AUDIO = 2
_PRIV_PUBLISH_VIDEO = 3
_PRIV_PUBLISH_DATA = 4


def _pack_uint16(x: int) -> bytes:
    return struct.pack("<H", x)


def _pack_uint32(x: int) -> bytes:
    return struct.pack("<I", x)


def _pack_string(s: str) -> bytes:
    raw = s.encode("utf-8")
    return _pack_uint16(len(raw)) + raw


def _pack_map_uint32(m: dict) -> bytes:
    """Encode a {uint16: uint32} map as: count(uint16) + items."""
    out = BytesIO()
    out.write(_pack_uint16(len(m)))
    for k in sorted(m.keys()):
        out.write(_pack_uint16(k))
        out.write(_pack_uint32(m[k]))
    return out.getvalue()


class _AccessToken:
    """Minimal port of Agora's AccessToken (v006) used by RtcTokenBuilder."""

    VERSION = "006"

    def __init__(self, app_id: str, app_certificate: str, channel_name: str, uid: str):
        self.app_id = app_id
        self.app_certificate = app_certificate
        self.channel_name = channel_name
        self.uid = uid
        self.ts = int(time.time()) + 24 * 3600  # token-issue timestamp
        self.salt = secrets.randbits(32)
        self.message = {}  # privilege -> expire timestamp

    def add_privilege(self, privilege: int, expire_ts: int) -> None:
        self.message[privilege] = expire_ts

    def build(self) -> str:
        # Pack the message body
        body = BytesIO()
        body.write(_pack_uint32(self.salt))
        body.write(_pack_uint32(self.ts))
        body.write(_pack_map_uint32(self.message))
        msg_bytes = body.getvalue()

        # Sign with HMAC-SHA256(key=app_certificate, msg=app_id+channel+uid+msg)
        signing_input = (
            self.app_id.encode("utf-8")
            + self.channel_name.encode("utf-8")
            + self.uid.encode("utf-8")
            + msg_bytes
        )
        signature = hmac.new(
            self.app_certificate.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()

        # Build the final binary: crc_channel + crc_uid + msg_len + msg + sig_len + sig
        crc_channel = zlib.crc32(self.channel_name.encode("utf-8")) & 0xFFFFFFFF
        crc_uid = zlib.crc32(self.uid.encode("utf-8")) & 0xFFFFFFFF

        content = BytesIO()
        content.write(_pack_uint16(len(signature)))
        content.write(signature)
        content.write(_pack_uint32(crc_channel))
        content.write(_pack_uint32(crc_uid))
        content.write(_pack_uint16(len(msg_bytes)))
        content.write(msg_bytes)

        encoded = base64.b64encode(content.getvalue()).decode("ascii")
        return f"{self.VERSION}{self.app_id}{encoded}"


def _agora_credentials() -> tuple[str, str]:
    app_id = (getattr(settings, "AGORA_APP_ID", "") or os.getenv("AGORA_APP_ID", "")).strip()
    app_cert = (
        getattr(settings, "AGORA_APP_CERTIFICATE", "")
        or os.getenv("AGORA_APP_CERTIFICATE", "")
    ).strip()
    return app_id, app_cert


def channel_name_for_session(session) -> str:
    """A stable, opaque channel name for a session.

    Using session ID (not booking ID) keeps it tied to the lifecycle of a class
    session record. Prefix avoids collisions with other apps sharing the App ID.
    """
    return f"noor-session-{session.id}"


def build_rtc_token(
    session,
    user,
    role: str = "publisher",
    expire_seconds: int = 3600,
) -> dict:
    """Generate an Agora RTC token for the given session + user.

    Returns a dict with: app_id, channel, uid, token, role, expires_at.
    If Agora credentials are not configured, returns a dict with token=""
    and a clear error message so the frontend can show a fallback UI.
    """
    app_id, app_cert = _agora_credentials()
    channel = channel_name_for_session(session)
    # Stable per-user numeric UID so we get the same camera tile on reconnect.
    uid = user.id

    privilege_role = ROLE_PUBLISHER if role == "publisher" else ROLE_SUBSCRIBER
    expire_ts = int(time.time()) + max(60, int(expire_seconds))

    if not app_id or not app_cert:
        logger.warning(
            "Agora credentials missing — returning empty token for session %s. "
            "Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in the environment.",
            session.id,
        )
        return {
            "app_id": app_id,
            "channel": channel,
            "uid": uid,
            "token": "",
            "role": role,
            "expires_at": expire_ts,
            "configured": False,
        }

    access = _AccessToken(app_id, app_cert, channel, str(uid))
    access.add_privilege(_PRIV_JOIN_CHANNEL, expire_ts)
    if privilege_role == ROLE_PUBLISHER:
        access.add_privilege(_PRIV_PUBLISH_AUDIO, expire_ts)
        access.add_privilege(_PRIV_PUBLISH_VIDEO, expire_ts)
        access.add_privilege(_PRIV_PUBLISH_DATA, expire_ts)
    token = access.build()

    return {
        "app_id": app_id,
        "channel": channel,
        "uid": uid,
        "token": token,
        "role": role,
        "expires_at": expire_ts,
        "configured": True,
    }
