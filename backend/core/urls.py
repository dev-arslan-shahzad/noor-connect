from django.urls import path
from . import views

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/me/", views.MeView.as_view()),

    path("teachers/", views.TeacherListView.as_view()),
    path("teachers/nearby/", views.NearbyTeachersView.as_view()),
    path("teachers/apply/", views.TeacherApplyView.as_view()),
    path("teachers/<int:teacher_id>/", views.TeacherDetailView.as_view()),
    path("teachers/<int:teacher_id>/update/", views.TeacherUpdateView.as_view()),

    path("bookings/create/", views.BookingCreateView.as_view()),
    path("bookings/", views.BookingListView.as_view()),
    path("bookings/<int:booking_id>/", views.BookingDetailView.as_view()),
    path("bookings/<int:booking_id>/cancel/", views.BookingCancelView.as_view()),

    path("sessions/", views.SessionListView.as_view()),
    path("sessions/<int:session_id>/", views.SessionDetailView.as_view()),

    path("reviews/", views.ReviewView.as_view()),
]
