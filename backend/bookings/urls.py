from django.urls import path

from . import views

urlpatterns = [
    path("create/", views.BookingCreateView.as_view(), name="booking-create"),
    path("", views.BookingListView.as_view(), name="booking-list"),
    path("<int:booking_id>/", views.BookingDetailView.as_view(), name="booking-detail"),
    path("<int:booking_id>/cancel/", views.BookingCancelView.as_view(), name="booking-cancel"),
]
