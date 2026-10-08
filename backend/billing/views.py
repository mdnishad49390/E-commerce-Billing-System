from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.db import transaction

from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

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
    LoginAttempt,
    RecurringRun,
)
from .serializers import (
    UserDetailSerializer,
    UserManagementSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer,
    AuditLogSerializer,
    CompanySerializer,
    BankAccountSerializer,
    SettingsSerializer,
    PaymentMethodSerializer,
    ClientSerializer,
    ServiceSerializer,
    ClientServicePriceSerializer,
    SubscriptionSerializer,
    InvoiceTemplateSerializer,
    InvoiceListSerializer,
    InvoiceDetailSerializer,
    InvoiceCreateUpdateSerializer,
    InvoiceItemSerializer,
    PaymentSerializer,
    RecurringRunSerializer,
)
from .services import RecurringBillingService
from .permissions import (
    IsAdminRole,
    IsAccountantOrAdmin,
    IsStaffOrAbove,
    SettingsAndCompanyPermission,
    PaymentPermission,
    InvoicePermission,
    get_user_role,
)
from .filters import InvoiceFilter, ClientFilter, PaymentFilter
from .audit import record_audit_log, get_client_ip

User = get_user_model()


# ==============================================================================
# 1. AUTHENTICATION VIEWS
# ==============================================================================

class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates user, enforces rate limiting / account lockout on 5 failed attempts,
    and returns JWT access and refresh tokens with user profile.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        ip = get_client_ip(request)

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Check account lockout / rate limiting
        attempt, _ = LoginAttempt.objects.get_or_create(
            username=username,
            defaults={"ip_address": ip, "failed_attempts": 0}
        )

        if attempt.is_locked():
            remaining_seconds = int((attempt.locked_until - timezone.now()).total_seconds())
            remaining_minutes = max(1, remaining_seconds // 60)
            return Response(
                {
                    "detail": f"Account is temporarily locked due to multiple failed login attempts. Please try again after {remaining_minutes} minute(s)."
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 2. Check if user exists and is active
        target_user = User.objects.filter(username=username).first()
        if target_user and not target_user.is_active:
            record_audit_log(
                action=AuditLog.ACTION_LOGIN_FAILED,
                request=request,
                user=target_user,
                username=username,
                model_name="User",
                object_id=str(target_user.id),
                object_repr=f"Deactivated User ({username})",
                changes={"reason": "User is inactive"},
            )
            return Response(
                {"detail": "Your account has been deactivated. Please contact an administrator."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 3. Authenticate
        user = authenticate(request, username=username, password=password)

        if user is None:
            attempt.failed_attempts += 1
            attempt.last_attempt = timezone.now()
            attempt.ip_address = ip

            if attempt.failed_attempts >= 5:
                attempt.locked_until = timezone.now() + timedelta(minutes=15)
                attempt.save()
                record_audit_log(
                    action=AuditLog.ACTION_LOGIN_FAILED,
                    request=request,
                    username=username,
                    model_name="User",
                    changes={"attempts": attempt.failed_attempts, "locked": True},
                )
                return Response(
                    {
                        "detail": "Account locked for 15 minutes due to 5 consecutive failed login attempts."
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            attempt.save()
            record_audit_log(
                action=AuditLog.ACTION_LOGIN_FAILED,
                request=request,
                username=username,
                model_name="User",
                changes={"attempts": attempt.failed_attempts},
            )
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 4. Authentication Succeeded -> Reset lock and issue JWT
        attempt.failed_attempts = 0
        attempt.locked_until = None
        attempt.save()

        refresh = RefreshToken.for_user(user)

        record_audit_log(
            action=AuditLog.ACTION_LOGIN_SUCCESS,
            request=request,
            user=user,
            username=user.username,
            model_name="User",
            object_id=str(user.id),
            object_repr=user.username,
        )

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserDetailSerializer(user).data,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the provided refresh token and logs user out.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()

            record_audit_log(
                action=AuditLog.ACTION_LOGOUT,
                request=request,
                user=request.user,
                username=request.user.username,
                model_name="User",
                object_id=str(request.user.id),
                object_repr=request.user.username,
            )

            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """
    GET /api/auth/me/
    Returns details and role for the currently logged in user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Allows logged-in user to change their password.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        old_password = serializer.validated_data["old_password"]
        new_password = serializer.validated_data["new_password"]

        if not user.check_password(old_password):
            return Response({"old_password": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        record_audit_log(
            action=AuditLog.ACTION_PASSWORD_CHANGE,
            request=request,
            user=user,
            username=user.username,
            model_name="User",
            object_id=str(user.id),
            object_repr=user.username,
            changes={"note": "User changed own password"},
        )

        return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)


# ==============================================================================
# 2. USER MANAGEMENT & AUDIT LOG VIEWS (ADMIN ONLY)
# ==============================================================================

class UserManagementViewSet(viewsets.ModelViewSet):
    """
    /api/users/
    Admin-only user management: List, Create, Retrieve, Update, Deactivate (no hard delete), Password Reset.
    """
    queryset = User.objects.all().select_related("profile").order_by("-date_joined")
    serializer_class = UserManagementSerializer
    permission_classes = [IsAdminRole]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["username", "email", "date_joined", "is_active"]

    def perform_create(self, serializer):
        user = serializer.save()
        record_audit_log(
            action=AuditLog.ACTION_CREATE,
            request=self.request,
            model_name="User",
            object_id=str(user.id),
            object_repr=f"User {user.username}",
            changes={"username": user.username, "email": user.email, "role": serializer.data.get("role")},
        )

    def perform_update(self, serializer):
        user = serializer.save()
        record_audit_log(
            action=AuditLog.ACTION_UPDATE,
            request=self.request,
            model_name="User",
            object_id=str(user.id),
            object_repr=f"User {user.username}",
            changes={"username": user.username, "email": user.email, "role": serializer.data.get("role")},
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Deleting users is disabled for security and historical integrity. Please deactivate the user instead."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])

        action_name = "Activated" if user.is_active else "Deactivated"
        record_audit_log(
            action=AuditLog.ACTION_STATUS_CHANGE,
            request=request,
            model_name="User",
            object_id=str(user.id),
            object_repr=f"User {user.username}",
            changes={"is_active": user.is_active, "status": action_name},
        )

        return Response({
            "detail": f"User {user.username} has been {action_name.lower()}.",
            "is_active": user.is_active,
        })

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])

        record_audit_log(
            action=AuditLog.ACTION_PASSWORD_CHANGE,
            request=request,
            model_name="User",
            object_id=str(user.id),
            object_repr=f"User {user.username}",
            changes={"note": f"Password reset by Admin {request.user.username}"},
        )

        return Response({"detail": f"Password for {user.username} reset successfully."})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/audit-logs/
    Admin-only read-only audit log viewer with filters.
    """
    queryset = AuditLog.objects.all().select_related("user").order_by("-timestamp")
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ["action", "model_name", "username"]
    search_fields = ["username", "model_name", "object_repr", "object_id"]
    ordering_fields = ["timestamp", "action", "model_name"]


class RecurringRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/recurring-runs/
    Admin-only listing and triggering of recurring automated billing runs.
    """
    queryset = RecurringRun.objects.all().order_by("-run_time")
    serializer_class = RecurringRunSerializer
    permission_classes = [IsAdminRole]

    @action(detail=False, methods=["post"], permission_classes=[IsAdminRole])
    def trigger(self, request):
        period = request.data.get("period")
        result = RecurringBillingService.run_recurring_billing(
            target_period=period,
            trigger=RecurringRun.TRIGGER_MANUAL,
            force=True,
            catch_up=True,
            request=request,
        )
        return Response(result, status=status.HTTP_200_OK if result.get("status") != "FAILED" else status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get", "post"], permission_classes=[IsAdminRole])
    def preview(self, request):
        period = request.query_params.get("period") or request.data.get("period")
        result = RecurringBillingService.preview_next_run(target_period=period)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], permission_classes=[IsAccountantOrAdmin])
    def status(self, request):
        result = RecurringBillingService.get_dashboard_status()
        return Response(result, status=status.HTTP_200_OK)



# ==============================================================================
# 3. BILLING ENTITY VIEWSETS (STRICT PERMISSIONS & AUDITING)
# ==============================================================================

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [SettingsAndCompanyPermission]

    def perform_create(self, serializer):
        comp = serializer.save()
        record_audit_log(AuditLog.ACTION_CREATE, request=self.request, model_name="Company", object_id=comp.id, object_repr=comp.name)

    def perform_update(self, serializer):
        comp = serializer.save()
        record_audit_log(AuditLog.ACTION_UPDATE, request=self.request, model_name="Company", object_id=comp.id, object_repr=comp.name)

    def perform_destroy(self, instance):
        record_audit_log(AuditLog.ACTION_DELETE, request=self.request, model_name="Company", object_id=instance.id, object_repr=instance.name)
        instance.delete()


class BankAccountViewSet(viewsets.ModelViewSet):
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_classes = [SettingsAndCompanyPermission]

    def perform_create(self, serializer):
        company = serializer.validated_data.get("company")
        if not company:
            company = Company.objects.filter(is_default=True).first() or Company.objects.first()
            bank = serializer.save(company=company)
        else:
            bank = serializer.save()
        record_audit_log(AuditLog.ACTION_CREATE, request=self.request, model_name="BankAccount", object_id=bank.id, object_repr=str(bank))

    def perform_update(self, serializer):
        bank = serializer.save()
        record_audit_log(AuditLog.ACTION_UPDATE, request=self.request, model_name="BankAccount", object_id=bank.id, object_repr=str(bank))

    def perform_destroy(self, instance):
        record_audit_log(AuditLog.ACTION_DELETE, request=self.request, model_name="BankAccount", object_id=instance.id, object_repr=str(instance))
        instance.delete()


class SettingsViewSet(viewsets.ModelViewSet):
    queryset = Settings.objects.all()
    serializer_class = SettingsSerializer
    permission_classes = [SettingsAndCompanyPermission]

    def perform_create(self, serializer):
        st = serializer.save()
        record_audit_log(AuditLog.ACTION_CREATE, request=self.request, model_name="Settings", object_id=st.id, object_repr="Settings")

    def perform_update(self, serializer):
        st = serializer.save()
        record_audit_log(AuditLog.ACTION_UPDATE, request=self.request, model_name="Settings", object_id=st.id, object_repr="Settings")


class PaymentMethodViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [SettingsAndCompanyPermission]


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().prefetch_related("client_services__service")
    serializer_class = ClientSerializer
    filterset_class = ClientFilter
    search_fields = ["name", "contact_person", "phone", "email"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsStaffOrAbove()]
        return [IsAccountantOrAdmin()]

    def perform_create(self, serializer):
        cl = serializer.save()
        record_audit_log(AuditLog.ACTION_CREATE, request=self.request, model_name="Client", object_id=cl.id, object_repr=cl.name)

    def perform_update(self, serializer):
        cl = serializer.save()
        record_audit_log(AuditLog.ACTION_UPDATE, request=self.request, model_name="Client", object_id=cl.id, object_repr=cl.name)

    def perform_destroy(self, instance):
        record_audit_log(AuditLog.ACTION_DELETE, request=self.request, model_name="Client", object_id=instance.id, object_repr=instance.name)
        instance.delete()


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    search_fields = ["name", "code"]
    ordering_fields = ["name", "default_price"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsStaffOrAbove()]
        return [IsAccountantOrAdmin()]


class ClientServicePriceViewSet(viewsets.ModelViewSet):
    queryset = ClientServicePrice.objects.select_related("client", "service")
    serializer_class = ClientServicePriceSerializer
    filterset_fields = ["client", "service", "is_active"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsStaffOrAbove()]
        return [IsAccountantOrAdmin()]


class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    /api/subscriptions/
    Management of recurring subscriptions.
    """
    queryset = Subscription.objects.select_related("client", "service")
    serializer_class = SubscriptionSerializer
    filterset_fields = ["client", "service", "billing_cycle", "auto_status", "is_active"]
    search_fields = ["custom_name", "client__name", "service__name"]
    ordering_fields = ["created_at", "start_date", "client__name"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsStaffOrAbove()]
        return [IsAccountantOrAdmin()]


class InvoiceTemplateViewSet(viewsets.ModelViewSet):
    queryset = InvoiceTemplate.objects.all()
    serializer_class = InvoiceTemplateSerializer
    permission_classes = [SettingsAndCompanyPermission]


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("client", "company", "bank_account", "template").prefetch_related("items", "payments")
    filterset_class = InvoiceFilter
    search_fields = ["invoice_number", "title", "client_name", "company_name"]
    ordering_fields = ["issue_date", "due_date", "payable_amount", "due_amount", "created_at"]
    ordering = ["-issue_date", "-id"]
    permission_classes = [InvoicePermission]

    def get_serializer_class(self):
        if self.action == "list":
            return InvoiceListSerializer
        elif self.action in ["create", "update", "partial_update"]:
            return InvoiceCreateUpdateSerializer
        return InvoiceDetailSerializer

    def perform_create(self, serializer):
        role = get_user_role(self.request.user)
        if role == UserProfile.ROLE_STAFF:
            serializer.save(status="DRAFT")
        else:
            serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = serializer.instance

        record_audit_log(
            AuditLog.ACTION_CREATE,
            request=request,
            model_name="Invoice",
            object_id=instance.id,
            object_repr=f"Invoice #{instance.invoice_number or instance.id}",
            changes={"status": instance.status, "payable": str(instance.payable_amount)},
        )

        detail_serializer = InvoiceDetailSerializer(instance, context=self.get_serializer_context())
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        role = get_user_role(request.user)
        req_status = request.data.get("status")

        # Staff cannot cancel or alter non-draft invoices
        if role == UserProfile.ROLE_STAFF:
            if instance.status != "DRAFT" or (req_status and req_status != "DRAFT"):
                return Response(
                    {"detail": "Staff members are only allowed to edit draft invoices and cannot issue or cancel them."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        old_status = instance.status
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        action_type = AuditLog.ACTION_STATUS_CHANGE if old_status != instance.status else AuditLog.ACTION_UPDATE
        record_audit_log(
            action_type,
            request=request,
            model_name="Invoice",
            object_id=instance.id,
            object_repr=f"Invoice #{instance.invoice_number or instance.id}",
            changes={"old_status": old_status, "new_status": instance.status, "payable": str(instance.payable_amount)},
        )

        detail_serializer = InvoiceDetailSerializer(instance, context=self.get_serializer_context())
        return Response(detail_serializer.data)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError

        if instance.payments.exists():
            raise ValidationError("Cannot delete an invoice that has associated payments.")

        if instance.status != "DRAFT":
            raise ValidationError(
                f"Cannot delete an invoice in '{instance.get_status_display()}' status. Only DRAFT invoices can be deleted; non-draft invoices must be cancelled instead."
            )

        record_audit_log(
            AuditLog.ACTION_DELETE,
            request=self.request,
            model_name="Invoice",
            object_id=instance.id,
            object_repr=f"Invoice #{instance.invoice_number or instance.id}",
            changes={"payable": str(instance.payable_amount), "paid": str(instance.paid_amount)},
        )
        instance.delete()

    @action(detail=True, methods=["post"], permission_classes=[IsAccountantOrAdmin])
    def record_payment(self, request, pk=None):
        invoice = self.get_object()
        amount = request.data.get("amount")
        payment_method_id = request.data.get("payment_method")
        note = request.data.get("note", "")
        transaction_id = request.data.get("transaction_id", "")
        payment_date = request.data.get("payment_date", timezone.now().date())

        if not amount:
            return Response({"error": "Payment amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_dec = Decimal(str(amount))
            if amount_dec <= 0:
                raise ValueError
        except Exception:
            return Response({"error": "Invalid payment amount"}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = None
        if payment_method_id:
            payment_method = PaymentMethod.objects.filter(id=payment_method_id).first()

        payment = Payment.objects.create(
            invoice=invoice,
            amount=amount_dec,
            payment_date=payment_date,
            payment_method=payment_method,
            transaction_id=transaction_id,
            note=note,
        )

        invoice.refresh_from_db()

        record_audit_log(
            AuditLog.ACTION_CREATE,
            request=request,
            model_name="Payment",
            object_id=payment.id,
            object_repr=f"Payment {payment.amount} for Inv #{invoice.invoice_number}",
            changes={"amount": str(payment.amount), "invoice_id": invoice.id, "new_invoice_status": invoice.status},
        )

        return Response({
            "message": "Payment recorded successfully",
            "payment": PaymentSerializer(payment).data,
            "invoice": InvoiceDetailSerializer(invoice, context={"request": request}).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAccountantOrAdmin])
    def recalculate(self, request, pk=None):
        invoice = self.get_object()
        invoice.calculate_totals()
        invoice.save()
        return Response(InvoiceDetailSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["get"], permission_classes=[IsStaffOrAbove])
    def download_pdf(self, request, pk=None):
        from .pdf_service import generate_invoice_pdf
        invoice = self.get_object()
        pdf_bytes = generate_invoice_pdf(invoice)
        filename = f"Invoice_{invoice.invoice_number or invoice.id}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=["get"], permission_classes=[IsStaffOrAbove])
    def preview_pdf(self, request, pk=None):
        from .pdf_service import generate_invoice_pdf
        invoice = self.get_object()
        pdf_bytes = generate_invoice_pdf(invoice)
        filename = f"Invoice_{invoice.invoice_number or invoice.id}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    @action(detail=False, methods=["post"], permission_classes=[IsAccountantOrAdmin])
    def generate_monthly_bills(self, request):
        """Batch-generate bills for all clients with subscribed services for a given month via RecurringBillingService"""
        billing_month = request.data.get("billing_month")
        if not billing_month:
            return Response({"error": "billing_month is required (e.g. 'May-2026')"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure any legacy ClientServicePrice records are mirrored in Subscription
        RecurringBillingService.sync_client_service_prices()

        run_result = RecurringBillingService.run_recurring_billing(
            target_period=billing_month,
            trigger=RecurringRun.TRIGGER_MANUAL,
            force=True,
            catch_up=False,
            request=request,
        )

        generated_invoices = run_result.get("created_invoices", [])
        skipped_raw = run_result.get("skipped_items", [])
        skipped_clients = [
            {
                "client_id": item.get("client_id"),
                "client_name": item.get("client_name"),
                "reason": item.get("reason"),
            }
            for item in skipped_raw
        ]

        return Response({
            "message": f"Successfully generated {len(generated_invoices)} bills for {billing_month}",
            "generated_invoices": generated_invoices,
            "skipped_clients": skipped_clients,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[IsStaffOrAbove])
    def summary(self, request):
        """Authoritative business KPI summary for dashboard and reporting"""
        from django.db.models import Sum, Count

        invoices_qs = Invoice.objects.exclude(status="CANCELLED")
        billed_agg = invoices_qs.aggregate(
            total_billed=Sum("payable_amount"),
            total_due=Sum("due_amount"),
            total_paid=Sum("paid_amount"),
            total_invoices=Count("id")
        )

        payment_agg = Payment.objects.filter(invoice__in=invoices_qs).aggregate(total_collected=Sum("amount"))
        total_collected = payment_agg["total_collected"] or Decimal("0.00")
        inv_paid = billed_agg["total_paid"] or Decimal("0.00")
        final_collected = max(total_collected, inv_paid)

        active_clients = Client.objects.filter(is_active=True).count()

        return Response({
            "total_billed": float(billed_agg["total_billed"] or Decimal("0.00")),
            "total_collected": float(final_collected),
            "total_due": float(billed_agg["total_due"] or Decimal("0.00")),
            "total_invoices": billed_agg["total_invoices"] or 0,
            "active_clients": active_clients,
        })


class InvoiceItemViewSet(viewsets.ModelViewSet):
    queryset = InvoiceItem.objects.all()
    serializer_class = InvoiceItemSerializer
    permission_classes = [IsAccountantOrAdmin]


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "invoice__client", "payment_method")
    serializer_class = PaymentSerializer
    filterset_class = PaymentFilter
    ordering = ["-payment_date", "-id"]
    permission_classes = [PaymentPermission]

    def perform_create(self, serializer):
        payment = serializer.save()
        record_audit_log(
            AuditLog.ACTION_CREATE,
            request=self.request,
            model_name="Payment",
            object_id=payment.id,
            object_repr=f"Payment {payment.amount} for Inv #{payment.invoice.invoice_number}",
            changes={"amount": str(payment.amount), "invoice_id": payment.invoice_id},
        )

    def perform_destroy(self, instance):
        record_audit_log(
            AuditLog.ACTION_DELETE,
            request=self.request,
            model_name="Payment",
            object_id=instance.id,
            object_repr=f"Payment {instance.amount} for Inv #{instance.invoice.invoice_number}",
            changes={"amount": str(instance.amount), "invoice_id": instance.invoice_id},
        )
        instance.delete()

    @action(detail=True, methods=["get"], permission_classes=[IsStaffOrAbove])
    def download_receipt(self, request, pk=None):
        from .pdf_service import generate_money_receipt_pdf
        payment = self.get_object()
        pdf_bytes = generate_money_receipt_pdf(payment)
        filename = f"Money_Receipt_{payment.receipt_number}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=["get"], permission_classes=[IsStaffOrAbove])
    def preview_receipt(self, request, pk=None):
        from .pdf_service import generate_money_receipt_pdf
        payment = self.get_object()
        pdf_bytes = generate_money_receipt_pdf(payment)
        filename = f"Money_Receipt_{payment.receipt_number}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response
