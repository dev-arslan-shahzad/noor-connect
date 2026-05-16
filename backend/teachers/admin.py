from django.contrib import admin

from .models import TeacherProfile
from .tasks import send_teacher_verification_result


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "city",
        "verification_status",
        "average_rating",
        "total_reviews",
        "is_featured",
        "created_at",
    )
    list_filter = ("verification_status", "teaching_mode", "gender", "is_featured")
    search_fields = ("user__email", "user__full_name", "city", "bio")
    readonly_fields = ("average_rating", "total_reviews", "created_at")
    actions = ["approve_teachers", "reject_teachers", "mark_featured", "unmark_featured"]
    fieldsets = (
        (None, {"fields": ("user", "bio", "gender", "teaching_mode", "years_experience")}),
        ("Pricing & subjects", {"fields": ("hourly_rate", "languages", "subjects")}),
        ("Location", {"fields": ("city", "latitude", "longitude")}),
        ("Documents", {"fields": ("certificate", "cnic")}),
        ("Verification", {"fields": ("verification_status", "rejection_reason", "is_featured")}),
        ("Stats", {"fields": ("average_rating", "total_reviews", "created_at")}),
    )

    @admin.action(description="Approve selected teachers")
    def approve_teachers(self, request, queryset):
        count = 0
        for teacher in queryset:
            teacher.verification_status = "verified"
            teacher.rejection_reason = ""
            teacher.save(update_fields=["verification_status", "rejection_reason"])
            send_teacher_verification_result.delay(teacher.id, "verified")
            count += 1
        self.message_user(request, f"{count} teacher(s) approved and notified.")

    @admin.action(description="Reject selected teachers")
    def reject_teachers(self, request, queryset):
        count = 0
        for teacher in queryset:
            teacher.verification_status = "rejected"
            teacher.save(update_fields=["verification_status"])
            send_teacher_verification_result.delay(
                teacher.id, "rejected", teacher.rejection_reason
            )
            count += 1
        self.message_user(request, f"{count} teacher(s) rejected and notified.")

    @admin.action(description="Mark as featured")
    def mark_featured(self, request, queryset):
        updated = queryset.update(is_featured=True)
        self.message_user(request, f"{updated} teacher(s) marked as featured.")

    @admin.action(description="Remove featured")
    def unmark_featured(self, request, queryset):
        updated = queryset.update(is_featured=False)
        self.message_user(request, f"{updated} teacher(s) unmarked.")
