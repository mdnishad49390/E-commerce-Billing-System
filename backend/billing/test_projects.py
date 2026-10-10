from decimal import Decimal
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    UserProfile,
    Settings,
    Client,
    Project,
    ProjectStatus,
    ProjectPriority,
    BillingMethod,
    DocumentCategory,
    ProjectModule,
    ProjectExpense,
    ProjectDocument,
    ProjectRolePermission,
    AuditLog,
)

User = get_user_model()


class ProjectModuleTests(APITestCase):
    def setUp(self):
        # Create users for all three roles
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@test.com",
            password="Password123!",
        )
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)

        self.accountant = User.objects.create_user(
            username="accountant_user",
            email="accountant@test.com",
            password="Password123!",
        )
        UserProfile.objects.create(user=self.accountant, role=UserProfile.ROLE_ACCOUNTANT)

        self.staff = User.objects.create_user(
            username="staff_user",
            email="staff@test.com",
            password="Password123!",
        )
        UserProfile.objects.create(user=self.staff, role=UserProfile.ROLE_STAFF)

        # Settings
        self.settings, _ = Settings.objects.get_or_create(
            id=1,
            defaults={
                "currency_symbol": "Tk",
                "currency_code": "BDT",
                "project_code_prefix": "PRJ",
                "project_code_digits": 4,
                "project_code_include_year": True,
                "project_receipt_allowed_extensions": "pdf,png,jpg,jpeg",
                "project_receipt_max_size_mb": 5,
                "project_doc_allowed_extensions": "pdf,docx,xlsx,png,jpg,zip",
                "project_doc_max_size_mb": 25,
                "project_list_default_columns": ["code", "name", "client", "status", "budget"],
            }
        )
        self.settings.project_code_prefix = "PRJ"
        self.settings.project_code_digits = 4
        self.settings.project_code_include_year = True
        self.settings.project_receipt_allowed_extensions = "pdf,png,jpg,jpeg"
        self.settings.project_receipt_max_size_mb = 5
        self.settings.project_doc_allowed_extensions = "pdf,docx,xlsx,png,jpg,zip"
        self.settings.project_doc_max_size_mb = 25
        self.settings.save()

        # Lookups (retrieve seeded or get_or_create)
        self.status_draft, _ = ProjectStatus.objects.get_or_create(
            name="Draft",
            defaults={"color": "#64748B", "sort_order": 1, "is_initial": True, "is_default": True, "allow_staff_set": True, "is_closed": False}
        )
        self.status_draft.is_active = True
        self.status_draft.is_default = True
        self.status_draft.is_initial = True
        self.status_draft.save()

        self.status_active, _ = ProjectStatus.objects.get_or_create(
            name="Active",
            defaults={"color": "#0284C7", "sort_order": 2, "allow_staff_set": True, "is_closed": False}
        )
        self.status_active.is_active = True
        self.status_active.save()

        self.status_closed, _ = ProjectStatus.objects.get_or_create(
            name="Completed",
            defaults={"color": "#10B981", "sort_order": 3, "is_closed": True}
        )
        self.status_closed.is_active = True
        self.status_closed.save()

        self.priority_low, _ = ProjectPriority.objects.get_or_create(
            name="Low",
            defaults={"color": "#94A3B8", "sort_order": 1, "weight": 1}
        )
        self.priority_low.is_active = True
        self.priority_low.save()

        self.priority_medium, _ = ProjectPriority.objects.get_or_create(
            name="Medium",
            defaults={"color": "#3B82F6", "sort_order": 2, "weight": 2, "is_default": True}
        )
        self.priority_medium.is_active = True
        self.priority_medium.is_default = True
        self.priority_medium.save()

        self.billing_fixed, _ = BillingMethod.objects.get_or_create(
            name="Fixed Price",
            defaults={"color": "#6366F1", "sort_order": 1, "is_default": True}
        )
        self.billing_fixed.is_active = True
        self.billing_fixed.is_default = True
        self.billing_fixed.save()

        self.billing_hourly, _ = BillingMethod.objects.get_or_create(
            name="Hourly",
            defaults={"color": "#06B6D4", "sort_order": 2}
        )
        self.billing_hourly.is_active = True
        self.billing_hourly.save()

        self.doc_cat_contract, _ = DocumentCategory.objects.get_or_create(
            name="Contract",
            defaults={"color": "#64748B", "sort_order": 1, "is_default": True}
        )
        self.doc_cat_contract.is_active = True
        self.doc_cat_contract.save()

        # Role Permissions
        ProjectRolePermission.objects.get_or_create(
            role=UserProfile.ROLE_ADMIN,
            defaults={
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": True,
                "can_manage_expenses": True,
                "can_manage_documents": True,
                "can_manage_modules": True,
                "can_change_status": True,
                "can_manage_config": True,
            }
        )
        self.accountant_perm, _ = ProjectRolePermission.objects.get_or_create(
            role=UserProfile.ROLE_ACCOUNTANT,
            defaults={
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": False,
                "can_manage_expenses": True,
                "can_manage_documents": True,
                "can_manage_modules": True,
                "can_change_status": True,
                "can_manage_config": False,
            }
        )
        self.accountant_perm.can_view = True
        self.accountant_perm.can_create = True
        self.accountant_perm.can_edit = True
        self.accountant_perm.can_delete = False
        self.accountant_perm.can_manage_expenses = True
        self.accountant_perm.can_manage_documents = True
        self.accountant_perm.can_manage_modules = True
        self.accountant_perm.can_change_status = True
        self.accountant_perm.can_manage_config = False
        self.accountant_perm.save()

        self.staff_perm, _ = ProjectRolePermission.objects.get_or_create(
            role=UserProfile.ROLE_STAFF,
            defaults={
                "can_view": True,
                "can_create": False,
                "can_edit": False,
                "can_delete": False,
                "can_manage_expenses": False,
                "can_manage_documents": True,
                "can_manage_modules": False,
                "can_change_status": False,
                "can_manage_config": False,
            }
        )
        self.staff_perm.can_view = True
        self.staff_perm.can_create = False
        self.staff_perm.can_edit = False
        self.staff_perm.can_delete = False
        self.staff_perm.can_manage_expenses = False
        self.staff_perm.can_manage_documents = True
        self.staff_perm.can_manage_modules = False
        self.staff_perm.can_change_status = False
        self.staff_perm.can_manage_config = False
        self.staff_perm.save()

        # Client
        self.client = Client.objects.create(
            name="Apex Footwear",
            contact_person="Rahim Ahmed",
            phone="+8801700000000",
            email="rahim@apex.com",
        )

    # --------------------------------------------------------------------------
    # 1. Code generation
    # --------------------------------------------------------------------------
    def test_project_code_generation_sequential_and_format(self):
        """Codes are sequential, unique, formatted based on settings, and immutable when settings change."""
        current_year = date.today().year
        p1 = Project.objects.create(
            name="Project Alpha",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
            total_budget=Decimal("50000.00"),
        )
        expected_code_1 = f"PRJ-{current_year}-0001"
        self.assertEqual(p1.code, expected_code_1)

        p2 = Project.objects.create(
            name="Project Beta",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
            total_budget=Decimal("25000.00"),
        )
        expected_code_2 = f"PRJ-{current_year}-0002"
        self.assertEqual(p2.code, expected_code_2)

        # Changing Settings format affects only NEW projects, old codes remain unchanged
        self.settings.project_code_prefix = "PROJ"
        self.settings.project_code_digits = 5
        self.settings.project_code_include_year = False
        self.settings.save()

        p3 = Project.objects.create(
            name="Project Gamma",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
            total_budget=Decimal("10000.00"),
        )
        self.assertEqual(p3.code, "PROJ-00001")

        # Old projects keep original codes
        p1.refresh_from_db()
        p2.refresh_from_db()
        self.assertEqual(p1.code, expected_code_1)
        self.assertEqual(p2.code, expected_code_2)

    # --------------------------------------------------------------------------
    # 2. Lookup rules
    # --------------------------------------------------------------------------
    def test_lookup_one_default_per_type(self):
        """Setting an option as default unsets default on other options of that type."""
        self.assertTrue(self.priority_medium.is_default)
        self.assertFalse(self.priority_low.is_default)

        # Make Low the default
        self.priority_low.is_default = True
        self.priority_low.save()

        self.priority_medium.refresh_from_db()
        self.assertTrue(self.priority_low.is_default)
        self.assertFalse(self.priority_medium.is_default)

    def test_lookup_unique_names_case_insensitive(self):
        """Creating an option with a duplicate name (case-insensitive) fails."""
        self.client_app = self.client  # avoid naming collision
        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        res = self.client_api.post(
            "/api/project-options/statuses/",
            {"name": "draft", "color": "#123456"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", str(res.data))

    def test_cannot_deactivate_last_active_option(self):
        """Deactivating the only active option of a type is rejected."""
        # Deactivate all priorities except Low
        ProjectPriority.objects.exclude(pk=self.priority_low.pk).update(is_active=False)

        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        res = self.client_api.patch(
            f"/api/project-options/priorities/{self.priority_low.pk}/",
            {"is_active": False},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_active", str(res.data))

    def test_in_use_option_cannot_be_deleted_but_can_be_deactivated(self):
        """Options currently in use by projects cannot be hard-deleted, but can be deactivated."""
        p = Project.objects.create(
            name="In Use Project",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
        )
        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        # Delete should be blocked with 400
        res = self.client_api.delete(f"/api/project-options/statuses/{self.status_draft.pk}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(ProjectStatus.objects.filter(pk=self.status_draft.pk).exists())

        # Deactivation should succeed
        res_patch = self.client_api.patch(
            f"/api/project-options/statuses/{self.status_draft.pk}/",
            {"is_active": False},
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.status_draft.refresh_from_db()
        self.assertFalse(self.status_draft.is_active)

        # Existing project still references deactivated status
        p.refresh_from_db()
        self.assertEqual(p.status.id, self.status_draft.id)

    def test_deactivated_option_cannot_be_chosen_for_new_project(self):
        """A deactivated option cannot be chosen for new records."""
        self.billing_hourly.is_active = False
        self.billing_hourly.save()

        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        res = self.client_api.post(
            "/api/projects/",
            {
                "name": "New Project with Deactivated Option",
                "client": self.client.id,
                "billing_method": self.billing_hourly.id,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("billing_method", str(res.data))

    # --------------------------------------------------------------------------
    # 3. Behavior flags (logic does not depend on names or slugs)
    # --------------------------------------------------------------------------
    def test_custom_closed_status_blocks_new_expenses_regardless_of_name(self):
        """A brand new status with a custom name and is_closed=True blocks expenses for non-admins."""
        custom_closed = ProjectStatus.objects.create(
            name="Archived & Locked Away",
            color="#000000",
            sort_order=99,
            is_closed=True,
        )

        p = Project.objects.create(
            name="Custom Status Project",
            client=self.client,
            status=custom_closed,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
        )

        # Non-admin (accountant) cannot add expense to closed project
        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.accountant)

        res = self.client_api.post(
            f"/api/projects/{p.id}/expenses/",
            {
                "expense_name": "Server Cost",
                "date": str(date.today()),
                "amount": "150.00",
                "is_billable": True,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("closed", str(res.data).lower())

        # Renaming the status has ZERO effect on behavior
        custom_closed.name = "Completely Different Name"
        custom_closed.save()

        res_renamed = self.client_api.post(
            f"/api/projects/{p.id}/expenses/",
            {
                "expense_name": "Server Cost",
                "date": str(date.today()),
                "amount": "150.00",
                "is_billable": True,
            },
        )
        self.assertEqual(res_renamed.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 4. Validation
    # --------------------------------------------------------------------------
    def test_validation_rules(self):
        """Validations: end_date < start_date, progress outside 0-100, expense amount <= 0."""
        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        # end_date < start_date rejected
        res = self.client_api.post(
            "/api/projects/",
            {
                "name": "Invalid Dates Project",
                "client": self.client.id,
                "start_date": str(date.today()),
                "end_date": str(date.today() - timedelta(days=5)),
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", str(res.data))

        # Create valid project
        p = Project.objects.create(
            name="Valid Project",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
        )

        # Module progress > 100 rejected
        res_mod = self.client_api.post(
            f"/api/projects/{p.id}/modules/",
            {"name": "Frontend", "progress_percent": 120},
        )
        self.assertEqual(res_mod.status_code, status.HTTP_400_BAD_REQUEST)

        # Expense amount <= 0 rejected
        res_exp = self.client_api.post(
            f"/api/projects/{p.id}/expenses/",
            {"expense_name": "Bad Amount", "date": str(date.today()), "amount": "-10.00"},
        )
        self.assertEqual(res_exp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_file_upload_limits_from_settings(self):
        """File upload extension and size restrictions are governed by Settings rows."""
        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        p = Project.objects.create(
            name="File Test Project",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
        )

        # Upload disallowed extension (.exe)
        bad_file = SimpleUploadedFile("malware.exe", b"binarycontent", content_type="application/octet-stream")
        res_bad_ext = self.client_api.post(
            f"/api/projects/{p.id}/documents/",
            {"title": "Program", "category": self.doc_cat_contract.id, "file": bad_file},
            format="multipart",
        )
        self.assertEqual(res_bad_ext.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not allowed", str(res_bad_ext.data))

        # Dynamically add 'exe' to settings and verify it is now accepted
        self.settings.project_doc_allowed_extensions += ",exe"
        self.settings.save()

        good_file = SimpleUploadedFile("program.exe", b"binarycontent", content_type="application/octet-stream")
        res_now_ok = self.client_api.post(
            f"/api/projects/{p.id}/documents/",
            {"title": "Program Allowed", "category": self.doc_cat_contract.id, "file": good_file},
            format="multipart",
        )
        self.assertEqual(res_now_ok.status_code, status.HTTP_201_CREATED)

    # --------------------------------------------------------------------------
    # 5. Exact Decimal math and list query optimization
    # --------------------------------------------------------------------------
    def test_budget_exact_decimal_math_and_query_count(self):
        """Budget math is exact Decimal (0.1 + 0.2 case) and query count does not scale with project count."""
        p = Project.objects.create(
            name="Decimal Math Project",
            client=self.client,
            status=self.status_draft,
            priority=self.priority_medium,
            billing_method=self.billing_fixed,
            total_budget=Decimal("10.00"),
        )
        ProjectExpense.objects.create(
            project=p,
            expense_name="Expense 1",
            date=date.today(),
            amount=Decimal("0.10"),
            is_billable=True,
        )
        ProjectExpense.objects.create(
            project=p,
            expense_name="Expense 2",
            date=date.today(),
            amount=Decimal("0.20"),
            is_billable=False,
        )

        # 0.10 + 0.20 = 0.30 exact Decimal
        self.assertEqual(p.actual_cost, Decimal("0.30"))
        self.assertEqual(p.used_budget, Decimal("0.30"))
        self.assertEqual(p.remaining_budget, Decimal("9.70"))
        self.assertFalse(p.is_over_budget)

        # Create more projects to test query scaling
        for i in range(5):
            proj = Project.objects.create(
                name=f"Batch Project {i}",
                client=self.client,
                status=self.status_draft,
                priority=self.priority_medium,
                billing_method=self.billing_fixed,
                total_budget=Decimal("100.00"),
            )
            ProjectExpense.objects.create(
                project=proj,
                expense_name=f"Expense {i}",
                date=date.today(),
                amount=Decimal("15.50"),
            )

        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        # Measuring queries on the list endpoint (assertNumQueries)
        # Exactly 2 queries: count + annotated/joined project list, regardless of row count
        with self.assertNumQueries(2):
            res = self.client_api.get("/api/projects/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertGreaterEqual(res.data["count"], 6)

    # --------------------------------------------------------------------------
    # 6. Dynamic permission matrix per role
    # --------------------------------------------------------------------------
    def test_permission_matrix_and_authentication_requirements(self):
        """Endpoints return 401 without login; permission matrix updates immediately change access."""
        self.client_api = self.client_class()

        # 401 without login
        res_anon = self.client_api.get("/api/projects/")
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        res_anon_config = self.client_api.get("/api/projects/config/")
        self.assertEqual(res_anon_config.status_code, status.HTTP_401_UNAUTHORIZED)

        # STAFF cannot create projects by default
        self.client_api.force_authenticate(user=self.staff)
        res_staff_create = self.client_api.post(
            "/api/projects/",
            {"name": "Staff Project", "client": self.client.id},
        )
        self.assertEqual(res_staff_create.status_code, status.HTTP_403_FORBIDDEN)

        # Dynamically grant can_create to STAFF in DB
        self.staff_perm.can_create = True
        self.staff_perm.save()

        res_staff_now_ok = self.client_api.post(
            "/api/projects/",
            {"name": "Staff Project Now Allowed", "client": self.client.id},
        )
        self.assertEqual(res_staff_now_ok.status_code, status.HTTP_201_CREATED)

    def test_audit_log_entries_created(self):
        """Audit log entries are recorded for create, update, status change, and delete."""
        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        # Create
        res_create = self.client_api.post(
            "/api/projects/",
            {"name": "Audited Project", "client": self.client.id},
        )
        project_id = res_create.data["id"]
        self.assertTrue(
            AuditLog.objects.filter(model_name="Project", object_id=str(project_id), action=AuditLog.ACTION_CREATE).exists()
        )

        # Status Change
        self.client_api.patch(
            f"/api/projects/{project_id}/",
            {"status": self.status_active.id},
        )
        self.assertTrue(
            AuditLog.objects.filter(model_name="Project", object_id=str(project_id), action=AuditLog.ACTION_STATUS_CHANGE).exists()
        )

    def test_config_endpoint_returns_only_active_options(self):
        """Config API returns only active options with proper structure."""
        self.status_draft.is_active = False
        self.status_draft.save()

        self.client_api = self.client_class()
        self.client_api.force_authenticate(user=self.admin)

        res = self.client_api.get("/api/projects/config/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        status_names = [s["name"] for s in res.data["statuses"]]
        self.assertNotIn("Draft", status_names)
        self.assertIn("Active", status_names)
        self.assertIn("permissions", res.data)
        self.assertIn("file_rules", res.data)
