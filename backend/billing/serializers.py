from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
from .models import (
    UserProfile,
    Company,
    BankAccount,
    Settings,
    PaymentMethod,
    Client,
    Service,
    ClientServicePrice,
    Subscription,
    InvoiceTemplate,
    Invoice,
    InvoiceItem,
    Payment,
    AuditLog,
    RecurringRun,
    ProjectStatus,
    ProjectPriority,
    BillingMethod,
    DocumentCategory,
    ProjectRolePermission,
    Project,
    ProjectModule,
    ProjectExpense,
    ProjectDocument,
)

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["role", "phone", "department"]


class UserDetailSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_superuser", "role", "phone", "department"]

    def get_role(self, obj):
        if obj.is_superuser:
            return UserProfile.ROLE_ADMIN
        if hasattr(obj, "profile"):
            return obj.profile.role
        return UserProfile.ROLE_STAFF

    def get_phone(self, obj):
        if hasattr(obj, "profile"):
            return obj.profile.phone
        return ""

    def get_department(self, obj):
        if hasattr(obj, "profile"):
            return obj.profile.department
        return ""


class BankAccountSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), required=False)

    class Meta:
        model = BankAccount
        fields = "__all__"


class CompanySerializer(serializers.ModelSerializer):
    bank_accounts = BankAccountSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = "__all__"


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settings
        fields = "__all__"


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = "__all__"


class ClientServicePriceSerializer(serializers.ModelSerializer):
    service_name = serializers.ReadOnlyField(source="service.name")

    class Meta:
        model = ClientServicePrice
        fields = "__all__"


class SubscriptionSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source="client.name")
    service_name = serializers.ReadOnlyField(source="service.name")
    effective_price = serializers.ReadOnlyField()
    effective_name = serializers.ReadOnlyField()
    effective_tech_specification = serializers.ReadOnlyField()

    class Meta:
        model = Subscription
        fields = "__all__"


class ClientSerializer(serializers.ModelSerializer):
    client_services = ClientServicePriceSerializer(many=True, read_only=True)
    subscriptions = SubscriptionSerializer(many=True, read_only=True)

    class Meta:
        model = Client
        fields = "__all__"


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = "__all__"


class InvoiceTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceTemplate
        fields = "__all__"


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ["id", "sl", "service", "item_name", "technical_specification", "quantity", "unit_price", "total"]
        read_only_fields = ["total"]


def check_payment_allowed(invoice, amount, replacing=None):
    """
    Shared payment validation (used by POST /payments/ and record_payment).
    `replacing` is an existing Payment being edited, whose amount is freed up.
    Returns the amount as a Decimal or raises serializers.ValidationError.
    """
    try:
        amount = Decimal(str(amount))
    except Exception:
        raise serializers.ValidationError("Invalid payment amount.")
    if amount <= 0:
        raise serializers.ValidationError("Payment amount must be greater than zero.")
    if invoice.status == "CANCELLED":
        raise serializers.ValidationError("Cannot record a payment on a cancelled invoice.")
    available = invoice.due_amount
    if replacing is not None and replacing.invoice_id == invoice.pk:
        available += replacing.amount
    if amount > available:
        raise serializers.ValidationError(
            f"Payment of {amount} exceeds the remaining due of {available} for invoice {invoice.invoice_number}."
        )
    return amount


class PaymentSerializer(serializers.ModelSerializer):
    payment_method_name = serializers.ReadOnlyField(source="payment_method.name")
    receipt_number = serializers.ReadOnlyField()
    invoice_number = serializers.ReadOnlyField(source="invoice.invoice_number")
    invoice_title = serializers.ReadOnlyField(source="invoice.title")
    client_name = serializers.ReadOnlyField(source="invoice.client_name")
    client_id = serializers.ReadOnlyField(source="invoice.client.id")
    currency_symbol = serializers.ReadOnlyField(source="invoice.currency_symbol")
    invoice_payable_amount = serializers.ReadOnlyField(source="invoice.payable_amount")
    invoice_due_amount = serializers.ReadOnlyField(source="invoice.due_amount")
    invoice_status = serializers.ReadOnlyField(source="invoice.status")

    class Meta:
        model = Payment
        fields = [
            "id",
            "invoice",
            "receipt_number",
            "invoice_number",
            "invoice_title",
            "client_name",
            "client_id",
            "currency_symbol",
            "invoice_payable_amount",
            "invoice_due_amount",
            "invoice_status",
            "amount",
            "payment_date",
            "payment_method",
            "payment_method_name",
            "transaction_id",
            "note",
            "created_at",
        ]

    def validate(self, attrs):
        invoice = attrs.get("invoice") or (self.instance.invoice if self.instance else None)
        amount = attrs.get("amount", self.instance.amount if self.instance else None)
        if invoice is not None and amount is not None:
            try:
                attrs["amount"] = check_payment_allowed(invoice, amount, replacing=self.instance)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"amount": exc.detail})
        return attrs


class InvoiceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "title",
            "billing_month",
            "billing_period",
            "subscription",
            "issue_date",
            "due_date",
            "status",
            "client_name",
            "currency_symbol",
            "sub_total",
            "discount",
            "vat_rate",
            "vat_amount",
            "payable_amount",
            "advance_amount",
            "paid_amount",
            "due_amount",
            "created_at",
        ]


class InvoiceDetailSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    qr_code_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    signature_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = "__all__"

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.qr_code.url) if request else obj.qr_code.url
        return None

    def get_logo_url(self, obj):
        if obj.company_logo_snapshot:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.company_logo_snapshot.url) if request else obj.company_logo_snapshot.url
        return None

    def get_signature_url(self, obj):
        if obj.company_signature_snapshot:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.company_signature_snapshot.url) if request else obj.company_signature_snapshot.url
        return None


class InvoiceCreateUpdateSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "title",
            "billing_month",
            "issue_date",
            "due_date",
            "status",
            "client",
            "company",
            "bank_account",
            "template",
            "currency_symbol",
            "discount",
            "vat_rate",
            "vat_amount",
            "advance_amount",
            "nb_text",
            "authorization_label",
            "received_by_label",
            "notes",
            "items",
            "subscription",
            "billing_period",
        ]
        read_only_fields = ["invoice_number"]
        validators = []
        extra_kwargs = {
            "billing_period": {"required": False, "allow_blank": True},
            "subscription": {"required": False, "allow_null": True},
        }

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        invoice = Invoice.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data, start=1):
            sl = item_data.pop("sl", idx)
            item = InvoiceItem(invoice=invoice, sl=sl, **item_data)
            item.save(skip_invoice_recalc=True)

        invoice.calculate_totals()
        Invoice.objects.filter(pk=invoice.pk).update(
            sub_total=invoice.sub_total,
            vat_amount=invoice.vat_amount,
            payable_amount=invoice.payable_amount,
            advance_amount=invoice.advance_amount,
            paid_amount=invoice.paid_amount,
            due_amount=invoice.due_amount,
            status=invoice.status,
        )
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data, start=1):
                sl = item_data.pop("sl", idx)
                item = InvoiceItem(invoice=instance, sl=sl, **item_data)
                item.save(skip_invoice_recalc=True)

        instance.calculate_totals()
        Invoice.objects.filter(pk=instance.pk).update(
            sub_total=instance.sub_total,
            vat_amount=instance.vat_amount,
            payable_amount=instance.payable_amount,
            advance_amount=instance.advance_amount,
            paid_amount=instance.paid_amount,
            due_amount=instance.due_amount,
            status=instance.status,
        )
        return instance


class UserManagementSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, default=UserProfile.ROLE_STAFF)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    department = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "date_joined",
            "role",
            "phone",
            "department",
            "password",
        ]
        read_only_fields = ["id", "date_joined"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_superuser:
            data["role"] = UserProfile.ROLE_ADMIN
        elif hasattr(instance, "profile"):
            data["role"] = instance.profile.role
            data["phone"] = instance.profile.phone
            data["department"] = instance.profile.department
        else:
            data["role"] = UserProfile.ROLE_STAFF
            data["phone"] = ""
            data["department"] = ""
        return data

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role", UserProfile.ROLE_STAFF)
        phone = validated_data.pop("phone", "")
        department = validated_data.pop("department", "")
        password = validated_data.pop("password", None)

        if not password:
            raise serializers.ValidationError({"password": "Password is required for new user."})

        user = User.objects.create_user(**validated_data, password=password)
        if role == UserProfile.ROLE_ADMIN:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        UserProfile.objects.update_or_create(
            user=user,
            defaults={"role": role, "phone": phone, "department": department}
        )
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        phone = validated_data.pop("phone", None)
        department = validated_data.pop("department", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        if role == UserProfile.ROLE_ADMIN:
            instance.is_staff = True
        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if role is not None:
            profile.role = role
        if phone is not None:
            profile.phone = phone
        if department is not None:
            profile.department = department
        profile.save()

        return instance
class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, min_length=6)
    confirm_password = serializers.CharField(required=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)
    confirm_password = serializers.CharField(required=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "New passwords do not match."})
        return attrs


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "username",
            "action",
            "model_name",
            "object_id",
            "object_repr",
            "changes",
            "ip_address",
            "timestamp",
        ]
        read_only_fields = fields


class RecurringRunSerializer(serializers.ModelSerializer):
    trigger_display = serializers.CharField(source="get_trigger_display", read_only=True)

    class Meta:
        model = RecurringRun
        fields = "__all__"


# ==============================================================================
# Dynamic Project Module Serializers
# ==============================================================================

class BaseConfigOptionSerializer(serializers.ModelSerializer):
    in_use_count = serializers.SerializerMethodField()

    def get_in_use_count(self, obj):
        count = 0
        for rel in obj._meta.related_objects:
            accessor = rel.get_accessor_name()
            if accessor and hasattr(obj, accessor):
                count += getattr(obj, accessor).count()
        return count

    def validate_name(self, value):
        clean_name = value.strip()
        qs = self.Meta.model.objects.filter(name__iexact=clean_name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"An option with name '{clean_name}' already exists.")
        return clean_name

    def validate_is_active(self, value):
        if self.instance and not value:
            active_count = self.Meta.model.objects.filter(is_active=True).exclude(pk=self.instance.pk).count()
            if active_count == 0:
                raise serializers.ValidationError("Cannot deactivate the last active option of this type.")
        return value


class ProjectStatusSerializer(BaseConfigOptionSerializer):
    class Meta:
        model = ProjectStatus
        fields = [
            "id", "name", "name_bn", "color", "sort_order",
            "is_active", "is_default", "is_closed", "is_initial",
            "allow_staff_set", "in_use_count", "created_at"
        ]


class ProjectPrioritySerializer(BaseConfigOptionSerializer):
    class Meta:
        model = ProjectPriority
        fields = [
            "id", "name", "name_bn", "color", "sort_order",
            "is_active", "is_default", "weight", "in_use_count", "created_at"
        ]


class BillingMethodSerializer(BaseConfigOptionSerializer):
    class Meta:
        model = BillingMethod
        fields = [
            "id", "name", "name_bn", "color", "sort_order",
            "is_active", "is_default", "in_use_count", "created_at"
        ]


class DocumentCategorySerializer(BaseConfigOptionSerializer):
    class Meta:
        model = DocumentCategory
        fields = [
            "id", "name", "name_bn", "color", "sort_order",
            "is_active", "is_default", "in_use_count", "created_at"
        ]


class ProjectRolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectRolePermission
        fields = [
            "id", "role", "can_view", "can_create", "can_edit", "can_delete",
            "can_manage_expenses", "can_manage_documents", "can_manage_modules",
            "can_change_status", "can_manage_config", "updated_at"
        ]


class ProjectModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectModule
        fields = ["id", "project", "name", "description", "progress_percent", "sort_order", "created_at"]
        read_only_fields = ["project", "created_at"]

    def validate_progress_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Progress percent must be between 0 and 100.")
        return value


class ProjectExpenseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source="created_by.username")
    receipt_filename = serializers.SerializerMethodField()

    class Meta:
        model = ProjectExpense
        fields = [
            "id", "project", "expense_name", "date", "amount",
            "description", "is_billable", "receipt", "receipt_filename",
            "created_by", "created_by_name", "created_at"
        ]
        read_only_fields = ["project", "created_at", "created_by", "receipt_filename"]

    def get_receipt_filename(self, obj):
        if obj.receipt:
            import os
            return os.path.basename(obj.receipt.name)
        return None

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Expense amount must be strictly greater than zero.")
        return value

    def validate_receipt(self, value):
        if value and hasattr(value, "size"):
            st = Settings.objects.first()
            allowed = getattr(st, "project_receipt_allowed_extensions", "pdf,png,jpg,jpeg") if st else "pdf,png,jpg,jpeg"
            max_mb = getattr(st, "project_receipt_max_size_mb", 5) if st else 5
            import os
            ext = os.path.splitext(value.name)[1].lower().lstrip(".")
            allowed_list = [e.strip().lower().lstrip(".") for e in allowed.split(",") if e.strip()]
            if ext not in allowed_list:
                raise serializers.ValidationError(
                    f"File extension '.{ext}' is not allowed. Allowed: {', '.join(allowed_list)}."
                )
            if value.size > max_mb * 1024 * 1024:
                raise serializers.ValidationError(
                    f"Receipt file exceeds maximum allowed size of {max_mb} MB."
                )
        return value


class ProjectDocumentSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source="category.name")
    category_color = serializers.ReadOnlyField(source="category.color")
    uploaded_by_name = serializers.ReadOnlyField(source="uploaded_by.username")
    file_name = serializers.SerializerMethodField()
    file_size_formatted = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDocument
        fields = [
            "id", "project", "title", "category", "category_name", "category_color",
            "file", "file_name", "file_size_formatted", "uploaded_by", "uploaded_by_name", "uploaded_at"
        ]
        read_only_fields = ["project", "uploaded_at", "uploaded_by", "file_name", "file_size_formatted"]

    def get_file_name(self, obj):
        if obj.file:
            import os
            return os.path.basename(obj.file.name)
        return None

    def get_file_size_formatted(self, obj):
        try:
            if obj.file and obj.file.size:
                size = obj.file.size
                if size < 1024:
                    return f"{size} B"
                elif size < 1024 * 1024:
                    return f"{size / 1024:.1f} KB"
                else:
                    return f"{size / (1024 * 1024):.1f} MB"
        except Exception:
            pass
        return ""

    def validate_file(self, value):
        if value and hasattr(value, "size"):
            st = Settings.objects.first()
            allowed = getattr(st, "project_doc_allowed_extensions", "pdf,docx,xlsx,png,jpg,zip") if st else "pdf,docx,xlsx,png,jpg,zip"
            max_mb = getattr(st, "project_doc_max_size_mb", 25) if st else 25
            import os
            ext = os.path.splitext(value.name)[1].lower().lstrip(".")
            allowed_list = [e.strip().lower().lstrip(".") for e in allowed.split(",") if e.strip()]
            if ext not in allowed_list:
                raise serializers.ValidationError(
                    f"File extension '.{ext}' is not allowed. Allowed: {', '.join(allowed_list)}."
                )
            if value.size > max_mb * 1024 * 1024:
                raise serializers.ValidationError(
                    f"Document file exceeds maximum allowed size of {max_mb} MB."
                )
        return value


class ProjectListSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source="client.name")
    status_name = serializers.ReadOnlyField(source="status.name")
    status_name_bn = serializers.ReadOnlyField(source="status.name_bn")
    status_color = serializers.ReadOnlyField(source="status.color")
    status_is_closed = serializers.ReadOnlyField(source="status.is_closed")
    priority_name = serializers.ReadOnlyField(source="priority.name")
    priority_color = serializers.ReadOnlyField(source="priority.color")
    priority_weight = serializers.ReadOnlyField(source="priority.weight")
    billing_method_name = serializers.ReadOnlyField(source="billing_method.name")
    billing_method_color = serializers.ReadOnlyField(source="billing_method.color")
    created_by_name = serializers.ReadOnlyField(source="created_by.username")

    actual_cost = serializers.SerializerMethodField()
    used_budget = serializers.SerializerMethodField()
    remaining_budget = serializers.SerializerMethodField()
    is_over_budget = serializers.SerializerMethodField()
    overall_progress = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    billable_total = serializers.SerializerMethodField()
    non_billable_total = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "code", "name", "client", "client_name",
            "start_date", "end_date", "status", "status_name", "status_name_bn",
            "status_color", "status_is_closed", "priority", "priority_name",
            "priority_color", "priority_weight", "billing_method", "billing_method_name",
            "billing_method_color", "total_budget", "estimated_cost", "actual_cost",
            "used_budget", "remaining_budget", "is_over_budget", "overall_progress",
            "documents_count", "billable_total", "non_billable_total",
            "comment", "created_by", "created_by_name", "created_at", "updated_at"
        ]

    def get_actual_cost(self, obj):
        # Use annotated value if present to prevent N+1
        if hasattr(obj, "annotated_actual_cost"):
            return str(obj.annotated_actual_cost)
        return str(obj.actual_cost)

    def get_used_budget(self, obj):
        return self.get_actual_cost(obj)

    def get_remaining_budget(self, obj):
        actual = Decimal(self.get_actual_cost(obj))
        return str(obj.total_budget - actual)

    def get_is_over_budget(self, obj):
        actual = Decimal(self.get_actual_cost(obj))
        return (obj.total_budget - actual) < Decimal("0.00")

    def get_overall_progress(self, obj):
        if hasattr(obj, "annotated_modules_count") and hasattr(obj, "annotated_modules_progress_sum"):
            cnt = obj.annotated_modules_count
            if cnt > 0:
                return round(float(obj.annotated_modules_progress_sum) / cnt, 1)
            return 0.0
        return obj.overall_progress

    def get_documents_count(self, obj):
        if hasattr(obj, "annotated_documents_count"):
            return obj.annotated_documents_count
        return obj.documents_count

    def get_billable_total(self, obj):
        if hasattr(obj, "annotated_billable_total"):
            return str(obj.annotated_billable_total)
        return str(obj.billable_total)

    def get_non_billable_total(self, obj):
        if hasattr(obj, "annotated_non_billable_total"):
            return str(obj.annotated_non_billable_total)
        return str(obj.non_billable_total)


class ProjectDetailSerializer(ProjectListSerializer):
    description = serializers.CharField(read_only=True)
    modules = ProjectModuleSerializer(many=True, read_only=True)
    expenses = ProjectExpenseSerializer(many=True, read_only=True)
    documents = ProjectDocumentSerializer(many=True, read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + ["description", "modules", "expenses", "documents"]


class ProjectCreateUpdateSerializer(serializers.ModelSerializer):
    status = serializers.PrimaryKeyRelatedField(
        queryset=ProjectStatus.objects.all(),
        required=False
    )
    priority = serializers.PrimaryKeyRelatedField(
        queryset=ProjectPriority.objects.all(),
        required=False
    )
    billing_method = serializers.PrimaryKeyRelatedField(
        queryset=BillingMethod.objects.all(),
        required=False
    )

    class Meta:
        model = Project
        fields = [
            "id", "code", "name", "client", "start_date", "end_date",
            "description", "status", "priority", "billing_method",
            "total_budget", "estimated_cost", "comment"
        ]
        read_only_fields = ["id", "code"]

    def validate(self, attrs):
        start = attrs.get("start_date") or (self.instance.start_date if self.instance else None)
        end = attrs.get("end_date") if "end_date" in attrs else (self.instance.end_date if self.instance else None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})

        # Ensure deactivated options cannot be newly selected
        for field_name, model_cls in [
            ("status", ProjectStatus),
            ("priority", ProjectPriority),
            ("billing_method", BillingMethod),
        ]:
            if field_name in attrs and attrs[field_name]:
                val = attrs[field_name]
                if not val.is_active:
                    current_val = getattr(self.instance, field_name, None) if self.instance else None
                    if current_val != val:
                        raise serializers.ValidationError(
                            {field_name: f"Cannot choose deactivated option '{val.name}'."}
                        )
        return attrs

    def create(self, validated_data):
        # Automatically assign is_initial status if not explicitly given
        if "status" not in validated_data or not validated_data["status"]:
            init_status = ProjectStatus.objects.filter(is_initial=True, is_active=True).first()
            if not init_status:
                init_status = ProjectStatus.objects.filter(is_default=True, is_active=True).first()
            if init_status:
                validated_data["status"] = init_status

        # Automatically assign default priority if not explicitly given
        if "priority" not in validated_data or not validated_data["priority"]:
            def_priority = ProjectPriority.objects.filter(is_default=True, is_active=True).first()
            if def_priority:
                validated_data["priority"] = def_priority

        # Automatically assign default billing method if not explicitly given
        if "billing_method" not in validated_data or not validated_data["billing_method"]:
            def_bm = BillingMethod.objects.filter(is_default=True, is_active=True).first()
            if def_bm:
                validated_data["billing_method"] = def_bm

        return super().create(validated_data)




