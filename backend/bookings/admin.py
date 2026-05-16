from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "teacher",
        "subject",
        "date",
        "start_time",
        "end_time",
        "status",
        "session_type",
        "meet_link",
    )
    list_filter = ("status", "session_type", "date")
    search_fields = (
        "student__email",
        "student__full_name",
        "teacher__user__email",
        "teacher__user__full_name",
        "subject",
    )
    date_hierarchy = "date"
    readonly_fields = ("created_at", "meet_link", "meet_room_id")
