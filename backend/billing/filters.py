import django_filters
from .models import Invoice, Client, Service, Payment


class InvoiceFilter(django_filters.FilterSet):
    billing_month = django_filters.CharFilter(lookup_expr="icontains")
    status = django_filters.ChoiceFilter(choices=Invoice.STATUS_CHOICES)
    client = django_filters.NumberFilter(field_name="client__id")
    issue_date_after = django_filters.DateFilter(field_name="issue_date", lookup_expr="gte")
    issue_date_before = django_filters.DateFilter(field_name="issue_date", lookup_expr="lte")
    min_amount = django_filters.NumberFilter(field_name="payable_amount", lookup_expr="gte")
    max_amount = django_filters.NumberFilter(field_name="payable_amount", lookup_expr="lte")
    has_due = django_filters.BooleanFilter(method="filter_has_due")

    class Meta:
        model = Invoice
        fields = ["status", "client", "billing_month", "company"]

    def filter_has_due(self, queryset, name, value):
        if value is True:
            return queryset.filter(due_amount__gt=0)
        elif value is False:
            return queryset.filter(due_amount=0)
        return queryset


class ClientFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr="icontains")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Client
        fields = ["name", "is_active"]


class PaymentFilter(django_filters.FilterSet):
    payment_date_after = django_filters.DateFilter(field_name="payment_date", lookup_expr="gte")
    payment_date_before = django_filters.DateFilter(field_name="payment_date", lookup_expr="lte")
    client = django_filters.NumberFilter(field_name="invoice__client__id")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Payment
        fields = ["invoice", "payment_method", "client", "payment_date_after", "payment_date_before"]

    def filter_search(self, queryset, name, value):
        from django.db.models import Q
        return queryset.filter(
            Q(transaction_id__icontains=value) |
            Q(note__icontains=value) |
            Q(invoice__invoice_number__icontains=value) |
            Q(invoice__client_name__icontains=value) |
            Q(invoice__title__icontains=value)
        )


class ProjectFilter(django_filters.FilterSet):
    status = django_filters.NumberFilter(field_name="status__id")
    priority = django_filters.NumberFilter(field_name="priority__id")
    client = django_filters.NumberFilter(field_name="client__id")
    billing_method = django_filters.NumberFilter(field_name="billing_method__id")
    start_date_after = django_filters.DateFilter(field_name="start_date", lookup_expr="gte")
    start_date_before = django_filters.DateFilter(field_name="start_date", lookup_expr="lte")
    end_date_after = django_filters.DateFilter(field_name="end_date", lookup_expr="gte")
    end_date_before = django_filters.DateFilter(field_name="end_date", lookup_expr="lte")
    is_closed = django_filters.BooleanFilter(field_name="status__is_closed")

    class Meta:
        from .models import Project
        model = Project
        fields = [
            "status", "priority", "client", "billing_method",
            "start_date_after", "start_date_before", "end_date_after", "end_date_before",
            "is_closed",
        ]


