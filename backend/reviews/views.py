from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from bookings.models import Booking
from bookings.permissions import IsStudent
from users.views import envelope, error_envelope

from .models import Review
from .serializers import ReviewCreateSerializer, ReviewSerializer


class ReviewListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsStudent()]
        return [AllowAny()]

    def get(self, request):
        qs = Review.objects.select_related("student", "teacher__user").all()
        teacher_id = request.query_params.get("teacher")
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        return envelope(ReviewSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_envelope("Validation failed", serializer.errors)
        data = serializer.validated_data

        booking = get_object_or_404(
            Booking.objects.select_related("teacher"),
            id=data["booking_id"],
        )
        if booking.student_id != request.user.id:
            return error_envelope(
                "Not allowed",
                "Only the student on the booking can leave a review.",
                status.HTTP_403_FORBIDDEN,
            )
        if booking.status != "completed":
            return error_envelope(
                "Booking not completed",
                "You can only review completed sessions.",
            )
        if Review.objects.filter(booking=booking).exists():
            return error_envelope("Already reviewed", "This booking already has a review.")

        review = Review.objects.create(
            booking=booking,
            student=request.user,
            teacher=booking.teacher,
            rating=data["rating"],
            comment=data.get("comment", ""),
        )
        return envelope(
            ReviewSerializer(review).data,
            "Review submitted",
            status.HTTP_201_CREATED,
        )
