from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "teacher", "student", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = (
        "student__email",
        "student__full_name",
        "teacher__user__email",
        "comment",
    )
    readonly_fields = ("created_at",)
