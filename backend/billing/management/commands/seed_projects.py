from django.core.management.base import BaseCommand
from billing.models import (
    ProjectStatus,
    ProjectPriority,
    BillingMethod,
    DocumentCategory,
    ProjectRolePermission,
    Settings,
)


class Command(BaseCommand):
    help = "Seeds initial dynamic project options, role permissions, and default settings"

    def handle(self, *args, **options):
        # Seed Statuses
        statuses = [
            {"name": "Draft", "color": "#64748B", "sort_order": 1, "is_initial": True, "is_default": True, "allow_staff_set": True, "is_closed": False},
            {"name": "Active", "color": "#0284C7", "sort_order": 2, "is_initial": False, "is_default": False, "allow_staff_set": True, "is_closed": False},
            {"name": "On Hold", "color": "#EAB308", "sort_order": 3, "is_initial": False, "is_default": False, "allow_staff_set": False, "is_closed": False},
            {"name": "Completed", "color": "#10B981", "sort_order": 4, "is_initial": False, "is_default": False, "allow_staff_set": False, "is_closed": True},
            {"name": "Cancelled", "color": "#EF4444", "sort_order": 5, "is_initial": False, "is_default": False, "allow_staff_set": False, "is_closed": True},
        ]
        for s in statuses:
            ProjectStatus.objects.get_or_create(name=s["name"], defaults=s)

        # Seed Priorities
        priorities = [
            {"name": "Low", "color": "#94A3B8", "sort_order": 1, "weight": 1, "is_default": False},
            {"name": "Medium", "color": "#3B82F6", "sort_order": 2, "weight": 2, "is_default": True},
            {"name": "High", "color": "#F97316", "sort_order": 3, "weight": 3, "is_default": False},
            {"name": "Urgent", "color": "#EF4444", "sort_order": 4, "weight": 4, "is_default": False},
        ]
        for p in priorities:
            ProjectPriority.objects.get_or_create(name=p["name"], defaults=p)

        # Seed Billing Methods
        methods = [
            {"name": "Fixed Price", "color": "#6366F1", "sort_order": 1, "is_default": True},
            {"name": "Hourly", "color": "#06B6D4", "sort_order": 2, "is_default": False},
            {"name": "Daily", "color": "#14B8A6", "sort_order": 3, "is_default": False},
            {"name": "Milestone", "color": "#8B5CF6", "sort_order": 4, "is_default": False},
        ]
        for m in methods:
            BillingMethod.objects.get_or_create(name=m["name"], defaults=m)

        # Seed Document Categories
        categories = [
            {"name": "Contract", "color": "#64748B", "sort_order": 1, "is_default": True},
            {"name": "Requirement", "color": "#0EA5E9", "sort_order": 2, "is_default": False},
            {"name": "Design", "color": "#EC4899", "sort_order": 3, "is_default": False},
            {"name": "Report", "color": "#F59E0B", "sort_order": 4, "is_default": False},
            {"name": "Other", "color": "#6B7280", "sort_order": 5, "is_default": False},
        ]
        for c in categories:
            DocumentCategory.objects.get_or_create(name=c["name"], defaults=c)

        # Seed Role Permissions
        permissions = [
            {
                "role": "ADMIN",
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": True,
                "can_manage_expenses": True,
                "can_manage_documents": True,
                "can_manage_modules": True,
                "can_change_status": True,
                "can_manage_config": True,
            },
            {
                "role": "ACCOUNTANT",
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": False,
                "can_manage_expenses": True,
                "can_manage_documents": True,
                "can_manage_modules": True,
                "can_change_status": True,
                "can_manage_config": False,
            },
            {
                "role": "STAFF",
                "can_view": True,
                "can_create": False,
                "can_edit": False,
                "can_delete": False,
                "can_manage_expenses": False,
                "can_manage_documents": True,
                "can_manage_modules": False,
                "can_change_status": False,
                "can_manage_config": False,
            },
        ]
        for perm in permissions:
            ProjectRolePermission.objects.get_or_create(role=perm["role"], defaults=perm)

        # Set default columns in Settings
        default_cols = [
            "code", "name", "client", "timespan", "status",
            "priority", "budget", "documents", "billing_method",
            "comment", "created_at"
        ]
        st = Settings.objects.first()
        if st and (not st.project_list_default_columns or len(st.project_list_default_columns) == 0):
            st.project_list_default_columns = default_cols
            st.save(update_fields=["project_list_default_columns"])

        self.stdout.write(self.style.SUCCESS("Successfully seeded project configuration."))
