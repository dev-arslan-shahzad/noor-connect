from rest_framework.permissions import BasePermission


class IsStudent(BasePermission):
    message = "Only students can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "student"
        )


class IsBookingParticipant(BasePermission):
    message = "You are not a participant of this booking."

    def has_object_permission(self, request, view, obj):
        if obj.student_id == request.user.id:
            return True
        teacher_user_id = getattr(obj.teacher, "user_id", None)
        return teacher_user_id == request.user.id
