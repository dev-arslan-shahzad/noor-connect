from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .email import send_verification_code
from .models import EmailVerificationCode, User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


def envelope(data=None, message="OK", status_code=status.HTTP_200_OK):
    return Response({"data": data, "message": message, "status": status_code}, status=status_code)


def error_envelope(error, detail="", status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": error, "detail": detail, "status": status_code}, status=status_code)


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(APIView):
    permission_classes = [AllowAny]
    # Accept multipart so the teacher signup can upload profile_photo /
    # certificate / cnic in the same request. JSONParser keeps the student
    # signup unchanged.
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_envelope("Validation failed", serializer.errors)
        user = serializer.save()

        code = EmailVerificationCode.generate_for(user)
        try:
            send_verification_code(user, code.code)
        except Exception as exc:
            # Don't block registration if email delivery fails — surface the
            # error so the user can hit "Resend code".
            return envelope(
                {"email": user.email, "delivery_error": str(exc)},
                "Account created but email delivery failed. Please use Resend code.",
                status.HTTP_201_CREATED,
            )

        return envelope(
            {"email": user.email},
            "Verification code sent. Check your email.",
            status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        code = (request.data.get("code") or "").strip()
        if not email or not code:
            return error_envelope("Validation failed", "Email and code are required.")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return error_envelope("Invalid code", "No matching verification code.")

        if user.is_email_verified:
            # Already verified — just hand back tokens so the user can proceed.
            payload = {"user": UserSerializer(user).data, **tokens_for(user)}
            return envelope(payload, "Email already verified.")

        try:
            record = (
                EmailVerificationCode.objects.filter(user=user, used_at__isnull=True)
                .order_by("-created_at")
                .first()
            )
        except EmailVerificationCode.DoesNotExist:
            record = None

        if record is None:
            return error_envelope(
                "Invalid code",
                "No active verification code. Please request a new one.",
            )

        if record.is_expired():
            return error_envelope(
                "Code expired",
                "This code has expired. Please request a new one.",
            )

        if record.attempts >= EmailVerificationCode.MAX_ATTEMPTS:
            # Burn the code so a fresh one is required.
            record.used_at = timezone.now()
            record.save(update_fields=["used_at"])
            return error_envelope(
                "Too many attempts",
                "This code has been locked. Please request a new one.",
            )

        if record.code != code:
            record.attempts += 1
            record.save(update_fields=["attempts"])
            return error_envelope("Invalid code", "The code you entered is incorrect.")

        # Success — mark code used and flip the user flag.
        record.used_at = timezone.now()
        record.save(update_fields=["used_at"])
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])

        payload = {"user": UserSerializer(user).data, **tokens_for(user)}
        return envelope(payload, "Email verified.")


class ResendCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return error_envelope("Validation failed", "Email is required.")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Don't reveal whether the email is registered — pretend it worked.
            return envelope({"email": email}, "If the account exists, a code was sent.")

        if user.is_email_verified:
            return error_envelope(
                "Already verified",
                "This account is already verified. Please log in.",
            )

        last = (
            EmailVerificationCode.objects.filter(user=user)
            .order_by("-created_at")
            .first()
        )
        if last is not None:
            elapsed = timezone.now() - last.created_at
            if elapsed < EmailVerificationCode.RESEND_COOLDOWN:
                wait = int(
                    (EmailVerificationCode.RESEND_COOLDOWN - elapsed).total_seconds()
                )
                return Response(
                    {
                        "error": "Cooldown",
                        "detail": f"Please wait {wait}s before requesting another code.",
                        "retry_after": wait,
                        "status": status.HTTP_429_TOO_MANY_REQUESTS,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        code = EmailVerificationCode.generate_for(user)
        try:
            send_verification_code(user, code.code)
        except Exception as exc:
            return error_envelope("Delivery failed", str(exc), status.HTTP_502_BAD_GATEWAY)

        return envelope({"email": email}, "A new verification code has been sent.")


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return error_envelope("Login failed", serializer.errors, status.HTTP_401_UNAUTHORIZED)
        user = serializer.validated_data["user"]
        if not user.is_email_verified:
            # Trigger a fresh code (respecting the resend cooldown) so the
            # frontend's redirect to /verify-email lands with a code in flight.
            last = (
                EmailVerificationCode.objects.filter(user=user)
                .order_by("-created_at")
                .first()
            )
            cooldown_active = (
                last is not None
                and (timezone.now() - last.created_at) < EmailVerificationCode.RESEND_COOLDOWN
            )
            if not cooldown_active:
                code = EmailVerificationCode.generate_for(user)
                try:
                    send_verification_code(user, code.code)
                except Exception:
                    # Surfaced to the user via the verify page's resend button.
                    pass
            return Response(
                {
                    "error": "Email not verified",
                    "detail": {
                        "code": "email_not_verified",
                        "email": user.email,
                        "message": "Please verify your email to continue.",
                    },
                    "status": status.HTTP_403_FORBIDDEN,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        payload = {"user": UserSerializer(user).data, **tokens_for(user)}
        return envelope(payload, "Login successful")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return error_envelope("Refresh token is required")
        try:
            RefreshToken(refresh).blacklist()
        except Exception as exc:
            return error_envelope("Invalid refresh token", str(exc))
        return envelope(message="Logout successful")


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return envelope(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        for field in ["full_name", "phone", "city", "is_learning_for_child", "child_name", "child_age"]:
            if field in request.data:
                setattr(user, field, request.data[field])
        if "profile_photo" in request.FILES:
            user.profile_photo = request.FILES["profile_photo"]
        user.save()
        return envelope(UserSerializer(user).data, "Profile updated")
