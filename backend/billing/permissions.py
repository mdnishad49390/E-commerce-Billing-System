from rest_framework import permissions
from .models import UserProfile


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return UserProfile.ROLE_ADMIN
    if hasattr(user, "profile"):
        return user.profile.role
    return UserProfile.ROLE_STAFF


class IsAdminRole(permissions.BasePermission):
    """Allows access only to Admin users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and get_user_role(request.user) == UserProfile.ROLE_ADMIN)


class IsAccountantOrAdmin(permissions.BasePermission):
    """Allows access to Accountants and Admins."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_user_role(request.user)
        return role in [UserProfile.ROLE_ADMIN, UserProfile.ROLE_ACCOUNTANT]


class IsStaffOrAbove(permissions.BasePermission):
    """Allows access to authenticated Staff, Accountant, and Admin users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class SettingsAndCompanyPermission(permissions.BasePermission):
    """
    - SAFE_METHODS (GET): Any authenticated user (Staff, Accountant, Admin)
    - Modify (POST, PUT, PATCH, DELETE): Admin only
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return get_user_role(request.user) == UserProfile.ROLE_ADMIN


class PaymentPermission(permissions.BasePermission):
    """
    - SAFE_METHODS (GET): Any authenticated user
    - Create (POST): Accountant or Admin
    - Update (PUT, PATCH): Accountant or Admin
    - Delete (DELETE): Accountant or Admin (STAFF cannot delete payment)
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        role = get_user_role(request.user)
        return role in [UserProfile.ROLE_ADMIN, UserProfile.ROLE_ACCOUNTANT]


class InvoicePermission(permissions.BasePermission):
    """
    - SAFE_METHODS (GET): Any authenticated user
    - Delete (DELETE): Admin only
    - Create (POST): Staff (Draft only), Accountant, Admin
    - Update (PUT, PATCH): Accountant, Admin (Staff cannot edit non-draft or cancel invoices)
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        role = get_user_role(request.user)

        if request.method in permissions.SAFE_METHODS:
            return True

        if request.method == "DELETE":
            return role == UserProfile.ROLE_ADMIN

        if request.method == "POST":
            # Staff can create DRAFT only (validated in serializer/perform_create)
            return role in [UserProfile.ROLE_ADMIN, UserProfile.ROLE_ACCOUNTANT, UserProfile.ROLE_STAFF]

        return role in [UserProfile.ROLE_ADMIN, UserProfile.ROLE_ACCOUNTANT]

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        role = get_user_role(request.user)
        if request.method == "DELETE":
            return role == UserProfile.ROLE_ADMIN

        if role == UserProfile.ROLE_STAFF:
            # Staff can only edit DRAFT invoices and cannot change status to CANCELLED or ISSUED
            if obj.status != "DRAFT":
                return False
            req_status = request.data.get("status")
            if req_status and req_status != "DRAFT":
                return False
            return True

        return role in [UserProfile.ROLE_ADMIN, UserProfile.ROLE_ACCOUNTANT]


# ==============================================================================
# Dynamic Project Module RBAC & Permissions
# ==============================================================================

def get_project_role_permissions(role):
    """Retrieves the dynamic ProjectRolePermission row for the specified role."""
    from .models import ProjectRolePermission, UserProfile

    if role == UserProfile.ROLE_ADMIN:
        # Admin is strictly immutable and always has full privileges
        class AdminPerms:
            can_view = True
            can_create = True
            can_edit = True
            can_delete = True
            can_manage_expenses = True
            can_manage_documents = True
            can_manage_modules = True
            can_change_status = True
            can_manage_config = True

        return AdminPerms()

    perm = ProjectRolePermission.objects.filter(role=role).first()
    return perm


def has_project_permission(user, action_name: str) -> bool:
    """Checks whether the authenticated user has a specific project permission."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    role = get_user_role(user)
    if role == UserProfile.ROLE_ADMIN:
        return True

    perm = get_project_role_permissions(role)
    if not perm:
        return False

    attr = f"can_{action_name}"
    return bool(getattr(perm, attr, False))


class ProjectPermission(permissions.BasePermission):
    """
    Enforces dynamic project permission matrix on ProjectViewSet:
    - SAFE_METHODS (GET): can_view
    - POST: can_create
    - PUT, PATCH: can_edit (or can_change_status when only status is transitioned)
    - DELETE: can_delete
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return has_project_permission(request.user, "view")

        if request.method == "POST":
            return has_project_permission(request.user, "create")

        if request.method == "DELETE":
            return has_project_permission(request.user, "delete")

        # PUT/PATCH
        return has_project_permission(request.user, "edit") or has_project_permission(request.user, "change_status")

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return has_project_permission(request.user, "view")

        if request.method == "DELETE":
            return has_project_permission(request.user, "delete")

        if request.method in ["PUT", "PATCH"]:
            # If user has can_edit, allowed
            if has_project_permission(request.user, "edit"):
                return True

            # If user does not have can_edit but only wants to change status:
            if has_project_permission(request.user, "change_status"):
                return True

            # If user is STAFF and target status allows staff to set:
            role = get_user_role(request.user)
            if role == UserProfile.ROLE_STAFF:
                target_status_id = request.data.get("status")
                if target_status_id:
                    from .models import ProjectStatus
                    target_status = ProjectStatus.objects.filter(pk=target_status_id).first()
                    if target_status and target_status.allow_staff_set:
                        # Only status is being modified
                        non_status_fields = [k for k in request.data.keys() if k != "status"]
                        if not non_status_fields:
                            return True
            return False

        return True


class ProjectConfigPermission(permissions.BasePermission):
    """
    Config endpoints (/api/projects/config/ and /api/project-options/):
    - SAFE_METHODS: can_view
    - Write: can_manage_config
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return has_project_permission(request.user, "view")

        return has_project_permission(request.user, "manage_config")


class ProjectSubresourcePermission(permissions.BasePermission):
    """
    Base permission for modules, expenses, and documents.
    Subclasses define resource_action ('manage_modules', 'manage_expenses', 'manage_documents').
    """
    resource_action = ""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return has_project_permission(request.user, "view")

        return has_project_permission(request.user, self.resource_action)


class ProjectModulePermission(ProjectSubresourcePermission):
    resource_action = "manage_modules"


class ProjectExpensePermission(ProjectSubresourcePermission):
    resource_action = "manage_expenses"


class ProjectDocumentPermission(ProjectSubresourcePermission):
    resource_action = "manage_documents"

