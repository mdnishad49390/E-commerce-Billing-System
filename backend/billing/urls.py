from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView,
    LogoutView,
    CurrentUserView,
    ChangePasswordView,
    UserManagementViewSet,
    AuditLogViewSet,
    CompanyViewSet,
    BankAccountViewSet,
    SettingsViewSet,
    PaymentMethodViewSet,
    ClientViewSet,
    ServiceViewSet,
    ClientServicePriceViewSet,
    SubscriptionViewSet,
    InvoiceTemplateViewSet,
    InvoiceViewSet,
    InvoiceItemViewSet,
    PaymentViewSet,
    RecurringRunViewSet,
    ProjectConfigView,
    ProjectOptionViewSet,
    ProjectRolePermissionViewSet,
    ProjectViewSet,
    ProjectModuleViewSet,
    ProjectExpenseViewSet,
    ProjectDocumentViewSet,
)

router = DefaultRouter()
router.register(r"users", UserManagementViewSet, basename="user")
router.register(r"audit-logs", AuditLogViewSet, basename="audit-log")
router.register(r"companies", CompanyViewSet, basename="company")
router.register(r"bank-accounts", BankAccountViewSet, basename="bank-account")
router.register(r"settings", SettingsViewSet, basename="settings")
router.register(r"payment-methods", PaymentMethodViewSet, basename="payment-method")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"services", ServiceViewSet, basename="service")
router.register(r"client-services", ClientServicePriceViewSet, basename="client-service")
router.register(r"subscriptions", SubscriptionViewSet, basename="subscription")
router.register(r"recurring-runs", RecurringRunViewSet, basename="recurring-run")
router.register(r"templates", InvoiceTemplateViewSet, basename="template")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"invoice-items", InvoiceItemViewSet, basename="invoice-item")
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"project-permissions", ProjectRolePermissionViewSet, basename="project-permission")

urlpatterns = [
    # Auth endpoints
    path("auth/login/", LoginView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="token_logout"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),

    # Project Module Specific Endpoints
    path("projects/config/", ProjectConfigView.as_view(), name="project-config"),
    path("project-options/<str:option_type>/", ProjectOptionViewSet.as_view({"get": "list", "post": "create"}), name="project-option-list"),
    path("project-options/<str:option_type>/reorder/", ProjectOptionViewSet.as_view({"post": "reorder"}), name="project-option-reorder"),
    path("project-options/<str:option_type>/<int:pk>/", ProjectOptionViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="project-option-detail"),

    # Project Subresources (Modules, Expenses, Documents)
    path("projects/<int:project_pk>/modules/", ProjectModuleViewSet.as_view({"get": "list", "post": "create"}), name="project-module-list"),
    path("projects/<int:project_pk>/modules/<int:pk>/", ProjectModuleViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="project-module-detail"),
    path("projects/<int:project_pk>/expenses/", ProjectExpenseViewSet.as_view({"get": "list", "post": "create"}), name="project-expense-list"),
    path("projects/<int:project_pk>/expenses/<int:pk>/", ProjectExpenseViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="project-expense-detail"),
    path("projects/<int:project_pk>/expenses/<int:pk>/receipt/", ProjectExpenseViewSet.as_view({"get": "download_receipt"}), name="project-expense-receipt"),
    path("projects/<int:project_pk>/documents/", ProjectDocumentViewSet.as_view({"get": "list", "post": "create"}), name="project-document-list"),
    path("projects/<int:project_pk>/documents/<int:pk>/", ProjectDocumentViewSet.as_view({"get": "retrieve", "delete": "destroy"}), name="project-document-detail"),
    path("projects/<int:project_pk>/documents/<int:pk>/download/", ProjectDocumentViewSet.as_view({"get": "download_file"}), name="project-document-download"),

    # REST APIs
    path("", include(router.urls)),
]

