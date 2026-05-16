from django.urls import path

from . import views

urlpatterns = [
    path("", views.SessionListView.as_view(), name="session-list"),
    path("<int:session_id>/", views.SessionDetailView.as_view(), name="session-detail"),
    path("<int:session_id>/start/", views.SessionStartView.as_view(), name="session-start"),
    path("<int:session_id>/end/", views.SessionEndView.as_view(), name="session-end"),
]
