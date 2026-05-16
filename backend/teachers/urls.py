from django.urls import path

from . import views

urlpatterns = [
    path("", views.TeacherListView.as_view(), name="teacher-list"),
    path("nearby/", views.NearbyTeachersView.as_view(), name="teacher-nearby"),
    path("apply/", views.TeacherApplyView.as_view(), name="teacher-apply"),
    path("<int:teacher_id>/", views.TeacherDetailView.as_view(), name="teacher-detail"),
    path("<int:teacher_id>/update/", views.TeacherUpdateView.as_view(), name="teacher-update"),
]
