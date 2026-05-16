from rest_framework.permissions import BasePermission


class IsTeacher(BasePermission):
    message = "Only teachers can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "teacher"
        )


class IsOwnTeacherProfile(BasePermission):
    message = "You can only edit your own teacher profile."

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
