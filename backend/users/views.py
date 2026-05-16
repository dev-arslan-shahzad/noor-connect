from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

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

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_envelope("Validation failed", serializer.errors)
        user = serializer.save()
        payload = {"user": UserSerializer(user).data, **tokens_for(user)}
        return envelope(payload, "Registration successful", status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return error_envelope("Login failed", serializer.errors, status.HTTP_401_UNAUTHORIZED)
        user = serializer.validated_data["user"]
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
