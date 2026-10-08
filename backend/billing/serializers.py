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



