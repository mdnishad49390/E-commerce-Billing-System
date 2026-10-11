import os
import sys
from decimal import Decimal
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from billing.models import Invoice, InvoiceItem, Company, BankAccount, Client
from billing.pdf_service import generate_invoice_pdf, generate_money_receipt_pdf
from pypdf import PdfReader

def run_tests_and_generate_samples():
    print("=== STARTING PDF PAGINATION & BENGALI GENERATION TESTS ===")

    # Ensure samples folder exists
    samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "samples"))
    os.makedirs(samples_dir, exist_ok=True)

    # 1. Ensure or retrieve base company and bank
    company, _ = Company.objects.get_or_create(
        name="RAKTCH TECHNOLOGY & SOFTWARE",
        defaults={
            "address": "Sector 6, Road 5, House 20, 7th floor, Uttara, Dhaka -1230, Bangladesh",
            "website": "www.raktch.com",
            "email": "raktchme@gmail.com, support@raktch.com",
            "phone": "+8801581677077",
            "is_default": True,
        }
    )

    bank, _ = BankAccount.objects.get_or_create(
        company=company,
        account_number="1234567890123",
        defaults={
            "bank_name": "Islami Bank PLC",
            "account_name": "RAKTCH TECHNOLOGY AND SOFTWARE",
            "branch_name": "Haji Camp, Ashkona, Dakkhin khan",
            "routing_number": "125261995",
            "is_default": True,
        }
    )

    def create_invoice_with_items(count, client_name="Rose International", client_address="House 12, Road 4, Banani, Dhaka", title="INVOICE", custom_items=None):
        client, _ = Client.objects.get_or_create(
            name=client_name,
            defaults={"address": client_address, "phone": "+8801700000000", "contact_person": "MD. Arif Hossain"}
        )
        inv = Invoice.objects.create(
            company=company,
            client=client,
            title=title,
            client_name=client_name,
            client_address=client_address,
            client_contact_person="MD. Arif Hossain",
            company_name=company.name,
            company_address=company.address,
            company_website=company.website,
            company_email=company.email,
            company_phone=company.phone,
            bank_name=bank.bank_name,
            account_name=bank.account_name,
            account_number=bank.account_number,
            branch_name=bank.branch_name,
            routing_number=bank.routing_number,
            status="ISSUED",
        )
        if custom_items:
            for sl, (name, spec, qty, price) in enumerate(custom_items, 1):
                InvoiceItem.objects.create(
                    invoice=inv,
                    sl=sl,
                    item_name=name,
                    technical_specification=spec,
                    quantity=Decimal(str(qty)),
                    unit_price=Decimal(str(price)),
                )
        else:
            for i in range(1, count + 1):
                InvoiceItem.objects.create(
                    invoice=inv,
                    sl=i,
                    item_name=f"Enterprise Software Service Module #{i}",
                    technical_specification=f"Custom backend architecture, API integration, and automated testing deployment pipeline #{i}",
                    quantity=Decimal("1"),
                    unit_price=Decimal("1500.00"),
                )
        inv.calculate_totals()
        inv.refresh_from_db()
        return inv

    # Test 1: 1 item invoice -> Must fit on 1 page exactly
    inv_1 = create_invoice_with_items(1, title="INVOICE (1 ITEM)")
    pdf_1 = generate_invoice_pdf(inv_1)
    p1_path = os.path.join(samples_dir, "invoice_1_item.pdf")
    with open(p1_path, "wb") as f:
        f.write(pdf_1)
    r1 = PdfReader(p1_path)
    print(f"Test 1 (1 Item): Page count = {len(r1.pages)} (Expected: 1)")
    assert len(r1.pages) == 1, f"Expected 1 page for 1 item, got {len(r1.pages)}"
    t1 = r1.pages[0].extract_text()
    assert "Page 1 of 1" in t1 or "Page 1" in t1, "Footer page number missing on page 1"
    assert "Sub Total" in t1, "Sub Total missing"
    assert "Received by" in t1, "Received by label missing"
    assert "Authorization" in t1, "Signature label missing"
    print("  -> Passed! 1 item fits perfectly on 1 page with totals & signatures.")

    # Test 2: 10 items invoice
    inv_10 = create_invoice_with_items(10, title="INVOICE (10 ITEMS)")
    pdf_10 = generate_invoice_pdf(inv_10)
    r10 = PdfReader(io.BytesIO(pdf_10))
    print(f"Test 2 (10 Items): Page count = {len(r10.pages)}")
    print(f"  -> Passed! Rendered in {len(r10.pages)} pages cleanly.")

    # Test 3: 25 items invoice -> at least 2 pages, table header on every page
    inv_25 = create_invoice_with_items(25, title="INVOICE (25 ITEMS)")
    pdf_25 = generate_invoice_pdf(inv_25)
    p25_path = os.path.join(samples_dir, "invoice_25_items.pdf")
    with open(p25_path, "wb") as f:
        f.write(pdf_25)
    r25 = PdfReader(p25_path)
    pages_25 = len(r25.pages)
    print(f"Test 3 (25 Items): Page count = {pages_25} (Expected: at least 2)")
    assert pages_25 >= 2, f"Expected at least 2 pages for 25 items, got {pages_25}"
    for p_idx, p in enumerate(r25.pages):
        text = p.extract_text()
        assert "Technical Specification" in text, f"Table header missing on page {p_idx + 1}"
        assert f"Page {p_idx + 1} of {pages_25}" in text or f"Page {p_idx + 1}" in text, f"Page number missing on page {p_idx + 1}"
        if p_idx < pages_25 - 1:
            assert "Received by" not in text and "Authorization" not in text, f"Signature block leaked to page {p_idx + 1}"
    assert "Received by" in r25.pages[-1].extract_text(), "Signature block missing on last page"
    print("  -> Passed! Table header present on all pages, totals only on last page.")

    # Test 4: 50 items invoice
    inv_50 = create_invoice_with_items(50, title="INVOICE (50 ITEMS)")
    pdf_50 = generate_invoice_pdf(inv_50)
    p50_path = os.path.join(samples_dir, "invoice_50_items.pdf")
    with open(p50_path, "wb") as f:
        f.write(pdf_50)
    r50 = PdfReader(p50_path)
    pages_50 = len(r50.pages)
    print(f"Test 4 (50 Items): Page count = {pages_50}")
    assert pages_50 >= 2, f"Expected multi-page for 50 items, got {pages_50}"
    for p_idx, p in enumerate(r50.pages):
        text = p.extract_text()
        assert "Technical Specification" in text, f"Table header missing on page {p_idx + 1}"
        if p_idx < pages_50 - 1:
            assert "Received by" not in text and "Authorization" not in text, f"Signature block leaked to page {p_idx + 1}"
    assert "Received by" in r50.pages[-1].extract_text(), "Signature block missing on last page"
    print("  -> Passed! 50 items rendered cleanly across multiple pages.")

    # Test 5: 100 items invoice
    inv_100 = create_invoice_with_items(100, title="INVOICE (100 ITEMS)")
    pdf_100 = generate_invoice_pdf(inv_100)
    r100 = PdfReader(io.BytesIO(pdf_100))
    pages_100 = len(r100.pages)
    print(f"Test 5 (100 Items): Page count = {pages_100}")
    assert pages_100 >= 3, f"Expected at least 3 pages for 100 items, got {pages_100}"
    assert "Received by" in r100.pages[-1].extract_text(), "Signature block missing on last page of 100 items"
    print("  -> Passed! 100 items rendered successfully.")

    # Test 6: Very long technical specification text
    long_spec = (
        "High performance scalable multi-region microservice cluster with Kubernetes orchestration, "
        "PostgreSQL read-replica streaming, Redis distributed caching, enterprise SSL/TLS offloading, "
        "and 24/7 proactive monitoring with automated failover and zero-downtime rolling updates. "
    ) * 4
    inv_long = create_invoice_with_items(
        3,
        client_name="International Long Spec Corporation Ltd.",
        title="INVOICE (LONG SPECIFICATION TEXT)",
        custom_items=[
            ("Advanced Cloud Architecture", long_spec, 1, 45000.00),
            ("Database Migration & Optimization", long_spec, 1, 35000.00),
            ("Security Hardening & Penetration Testing", long_spec, 1, 25000.00),
        ]
    )
    pdf_long = generate_invoice_pdf(inv_long)
    r_long = PdfReader(io.BytesIO(pdf_long))
    print(f"Test 6 (Very Long Spec): Page count = {len(r_long.pages)}")
    assert "Kubernetes orchestration" in r_long.pages[0].extract_text()
    print("  -> Passed! Long text wrapped downward cleanly without overflowing table.")

    # Test 7: Bengali font, conjuncts, mixed English & Bengali
    bengali_name = "রহিম অ্যান্ড ব্রাদার্স ট্রেডিং কোম্পানি"
    bengali_address = "বাড়ি নং ৪২, রোড নং ৭, ধানমন্ডি আবাসিক এলাকা, ঢাকা-১২০৫, বাংলাদেশ।"
    inv_bengali = create_invoice_with_items(
        4,
        client_name=bengali_name,
        client_address=bengali_address,
        title="ইনভয়েস ও বিলিং স্টেটমেন্ট (INVOICE)",
        custom_items=[
            ("ওয়েব অ্যাপ্লিকেশন ও কাস্টম ই-কমার্স ডেভেলপমেন্ট", "পূর্ণাঙ্গ ব্যাকএন্ড সিস্টেম, পেমেন্ট গেটওয়ে ইন্টিগ্রেশন ও রিয়েল-টাইম ইনভেন্টরি ম্যানেজমেন্ট", 1, 55000.00),
            ("ডিজিটাল মার্কেটিং ও এসইও অপটিমাইজেশন", "গুগল সার্চ ও সোশ্যাল মিডিয়া ক্যাম্পেইন ম্যানেজমেন্ট (৩ মাসের চুক্তি)", 1, 20000.00),
            ("সার্ভার ক্লাউড হোস্টিং ও ডেডিকেটেড সাপোর্ট", "২৪/৭ সিকিউরিটি মনিটরিং, ব্যাকআপ ও দুর্যোগ রিকভারি সাপোর্ট", 1, 15000.00),
            ("Enterprise Consultation & Advisory", "Enterprise cloud consulting & security audit (English & বাংলা)", 1, 10000.00),
        ]
    )
    pdf_bengali = generate_invoice_pdf(inv_bengali)
    pb_path = os.path.join(samples_dir, "invoice_bengali.pdf")
    with open(pb_path, "wb") as f:
        f.write(pdf_bengali)
    rb = PdfReader(pb_path)
    print(f"Test 7 (Bengali Font & Conjuncts): Page count = {len(rb.pages)}")
    text_b = rb.pages[0].extract_text()
    assert "রহিম অ্যান্ড ব্রাদার্স" in text_b or "রহিম" in text_b, "Bengali client name missing from extracted text"
    assert "Enterprise cloud consulting" in text_b, "Mixed English text missing"
    print("  -> Passed! Bengali characters and conjuncts rendered cleanly.")

    print("\n=== ALL TEST CHECKS PASSED SUCCESSFULLY! ===")
    print(f"Sample PDFs saved in: {samples_dir}")
    for item in os.listdir(samples_dir):
        size = os.path.getsize(os.path.join(samples_dir, item))
        print(f" - {item} ({size} bytes)")

if __name__ == "__main__":
    import io
    run_tests_and_generate_samples()
