from django.contrib import admin

from .models import ClassSession


@admin.register(ClassSession)
class ClassSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "is_active", "started_at", "ended_at", "meet_link")
    list_filter = ("is_active",)
    search_fields = (
        "booking__student__email",
        "booking__teacher__user__email",
        "booking__subject",
    )
    readonly_fields = ("meet_link",)
