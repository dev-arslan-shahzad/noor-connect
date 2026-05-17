from math import asin, cos, radians, sin, sqrt

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.views import envelope, error_envelope

from .models import TeacherProfile
from .permissions import IsOwnTeacherProfile, IsTeacher
from .serializers import (
    TeacherApplySerializer,
    TeacherDetailSerializer,
    TeacherSerializer,
    TeacherUpdateSerializer,
)
from .tasks import send_teacher_application_received


def _haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _apply_filters(qs, params):
    subject = params.get("subject")
    gender = params.get("gender")
    mode = params.get("mode")
    city = params.get("city")
    min_price = params.get("min_price")
    max_price = params.get("max_price")
    rating = params.get("rating")
    search = params.get("search")
    featured = params.get("featured")

    if subject:
        qs = qs.filter(subjects__contains=[subject])
    if gender and gender.lower() != "any":
        qs = qs.filter(gender__iexact=gender)
    if mode and mode.lower() != "any":
        qs = qs.filter(teaching_mode=mode)
    if city:
        qs = qs.filter(city__iexact=city)
    if min_price:
        try:
            qs = qs.filter(hourly_rate__gte=float(min_price))
        except ValueError:
            pass
    if max_price:
        try:
            qs = qs.filter(hourly_rate__lte=float(max_price))
        except ValueError:
            pass
    if rating:
        try:
            qs = qs.filter(average_rating__gte=float(rating))
        except ValueError:
            pass
    if search:
        qs = qs.filter(
            Q(user__full_name__icontains=search)
            | Q(bio__icontains=search)
            | Q(subjects__icontains=search)
        )
    if featured and featured.lower() in ("1", "true", "yes"):
        qs = qs.filter(is_featured=True)
    return qs


class TeacherListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = TeacherProfile.objects.filter(verification_status="verified").select_related("user")
        qs = _apply_filters(qs, request.query_params)

        ordering = request.query_params.get("ordering")
        ordering_map = {
            "highest_rated": "-average_rating",
            "lowest_price": "hourly_rate",
            "highest_price": "-hourly_rate",
            "most_reviews": "-total_reviews",
            "newest": "-created_at",
        }
        if ordering:
            qs = qs.order_by(ordering_map.get(ordering, ordering))

        data = TeacherSerializer(qs, many=True).data
        return envelope({"count": len(data), "results": data})


class TeacherDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, teacher_id):
        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            id=teacher_id,
        )
        return envelope(TeacherDetailSerializer(teacher).data)


class TeacherMeView(APIView):
    """Return the currently-authenticated teacher's own profile (any status)."""

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        profile = getattr(request.user, "teacher_profile", None)
        if not profile:
            return error_envelope(
                "No teacher profile",
                "You haven't applied yet. POST /api/teachers/apply/ to create one.",
                status.HTTP_404_NOT_FOUND,
            )
        return envelope(TeacherSerializer(profile).data)


class TeacherApplyView(APIView):
    permission_classes = [IsAuthenticated, IsTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        if hasattr(request.user, "teacher_profile"):
            return error_envelope(
                "Profile exists",
                "You already have a teacher profile. Use PATCH /api/teachers/<id>/update/ to edit.",
                status.HTTP_409_CONFLICT,
            )

        serializer = TeacherApplySerializer(data=request.data)
        if not serializer.is_valid():
            return error_envelope("Validation failed", serializer.errors)

        profile = serializer.save(user=request.user, verification_status="pending")
        send_teacher_application_received.delay(profile.id)
        return envelope(
            {"teacher_profile": TeacherSerializer(profile).data},
            "Application submitted. We will review within 24-48 hours.",
            status.HTTP_201_CREATED,
        )


class NearbyTeachersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        params = request.query_params
        lat = params.get("lat")
        lng = params.get("lng")
        radius = params.get("radius", "10")

        qs = TeacherProfile.objects.filter(verification_status="verified").select_related("user")
        qs = _apply_filters(qs, params)

        try:
            radius_km = float(radius)
        except ValueError:
            radius_km = 10.0

        if lat and lng:
            try:
                lat_f = float(lat)
                lng_f = float(lng)
            except ValueError:
                return error_envelope("Invalid coordinates", "lat and lng must be numeric")

            qs = qs.exclude(latitude__isnull=True).exclude(longitude__isnull=True)
            results = []
            for t in qs:
                distance = _haversine_km(lat_f, lng_f, t.latitude, t.longitude)
                if distance <= radius_km:
                    item = TeacherSerializer(t).data
                    item["distance_km"] = round(distance, 2)
                    results.append(item)
            results.sort(key=lambda x: x["distance_km"])
            return envelope({"count": len(results), "results": results})

        data = TeacherSerializer(qs, many=True).data
        return envelope({"count": len(data), "results": data})


class TeacherUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsOwnTeacherProfile]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, teacher_id):
        teacher = get_object_or_404(TeacherProfile, id=teacher_id)
        self.check_object_permissions(request, teacher)
        serializer = TeacherUpdateSerializer(teacher, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_envelope("Validation failed", serializer.errors)
        serializer.save()
        return envelope(TeacherSerializer(teacher).data, "Teacher profile updated")
