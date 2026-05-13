from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, StudentProfile, TeacherProfile, Booking, Session, Review


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("NoorConnect", {"fields": ("role", "full_name", "phone", "city", "avatar")}),
    )
    list_display = ("email", "full_name", "role", "is_staff", "is_active")
    search_fields = ("email", "full_name")
    ordering = ("email",)


admin.site.register(StudentProfile)
admin.site.register(TeacherProfile)
admin.site.register(Booking)
admin.site.register(Session)
admin.site.register(Review)
