/**
 * Centralized Internationalization (i18n) & Localization dictionary
 * Supports English ('en') and Bangla ('bn') translations for the Projects module.
 * No UI string literals should be hardcoded directly into components.
 */

export const translations = {
  en: {
    // Navigation
    nav_projects: "Projects",
    nav_new_project: "New Project",

    // Project List
    projects_title: "Projects",
    projects_subtitle: "Track client projects, budgets, modules, expenses, and documentation",
    search_placeholder: "Search code, project name, client...",
    filter_all_statuses: "All Statuses",
    filter_all_priorities: "All Priorities",
    filter_all_billing: "All Billing Methods",
    filter_all_clients: "All Clients",
    filter_open_projects: "Open Projects",
    filter_closed_projects: "Closed Projects",
    filter_all_lifecycle: "All Projects (Open & Closed)",
    filter_from_date: "From Date",
    filter_to_date: "To Date",
    clear_filters: "Clear Filters",
    no_projects_found: "No projects found",
    no_projects_desc: "Get started by creating your first client project.",
    create_first_project: "Create Project",
    total_projects_count: "Total Projects",

    // Columns
    col_code: "Project Code",
    col_name: "Project Name",
    col_client: "Client",
    col_timespan: "Timespan",
    col_status: "Status",
    col_priority: "Priority",
    col_budget: "Budget",
    col_actual_cost: "Actual Cost",
    col_documents: "Docs",
    col_billing_method: "Billing Method",
    col_comment: "Comment",
    col_created_date: "Created Date",
    col_actions: "Actions",

    // Values & Common
    not_set: "Not set",
    ongoing: "Ongoing",
    days: "days",
    view_details: "View Details",
    edit_project: "Edit Project",
    delete_project: "Delete Project",
    confirm_delete_project: "Are you sure you want to delete this project? Only projects without related expenses, documents, or modules can be deleted.",
    loading: "Loading...",
    saving: "Saving...",
    save_changes: "Save Changes",
    cancel: "Cancel",
    confirm: "Confirm",
    back_to_projects: "Back to Projects",

    // Project Form (New / Edit)
    form_create_title: "Create New Project",
    form_create_subtitle: "Set up a new client engagement with budget and milestones",
    form_edit_title: "Edit Project",
    form_edit_subtitle: "Update project information and configuration",
    field_project_name: "Project Name",
    field_project_name_placeholder: "e.g. ERP System Phase 1",
    field_client: "Client",
    field_client_placeholder: "Select client...",
    field_status: "Project Status",
    field_priority: "Project Priority",
    field_billing_method: "Billing Method",
    field_start_date: "Start Date",
    field_end_date: "End Date (Optional)",
    field_total_budget: "Total Budget",
    field_estimated_cost: "Estimated Cost",
    field_description: "Description",
    field_description_placeholder: "Describe the scope, objectives, and deliverables...",
    field_comment: "Internal Comment / Notes",
    field_comment_placeholder: "Private notes for the team...",
    error_name_required: "Project name is required.",
    error_client_required: "Client selection is required.",
    error_end_date_before_start: "End date cannot be earlier than start date.",

    // Project Details
    details_tab_overview: "Overview",
    details_tab_modules: "Modules & Progress",
    details_tab_budget: "Budget & Costs",
    details_tab_expenses: "Expenses",
    details_tab_documents: "Documents",

    // Budget Cards
    card_total_budget: "Total Budget",
    card_used_budget: "Used Budget",
    card_remaining_budget: "Remaining Budget",
    card_estimated_cost: "Estimated Cost",
    card_actual_cost: "Actual Cost",
    budget_usage: "Budget Consumption",
    over_budget_warning: "Over Budget Alert: Actual expenses exceed the allocated budget limit!",
    budget_healthy: "Budget on Track: Expenses are within the designated budget limit.",

    // Modules
    modules_title: "Work Modules & Milestones",
    modules_subtitle: "Breakdown of work items and their completion progress",
    add_module: "Add Module",
    edit_module: "Edit Module",
    delete_module: "Delete Module",
    module_name: "Module Name",
    module_name_placeholder: "e.g. Database Design & API Schema",
    module_progress: "Progress",
    module_sort_order: "Order",
    confirm_delete_module: "Are you sure you want to remove this module?",
    no_modules_yet: "No work modules defined yet.",
    overall_progress: "Overall Project Progress",

    // Expenses
    expenses_title: "Project Expenses",
    expenses_subtitle: "Direct costs and expenditures logged against this project",
    add_expense: "Add Expense",
    expense_name: "Expense Item",
    expense_name_placeholder: "e.g. Domain Renewal, Server Invoice",
    expense_amount: "Amount",
    expense_date: "Date",
    expense_billable: "Billable to Client",
    expense_non_billable: "Non-Billable Internal",
    expense_receipt: "Receipt / Invoice Attachment",
    view_receipt: "View Receipt",
    download_receipt: "Download Receipt",
    no_receipt: "No receipt",
    total_billable: "Total Billable",
    total_non_billable: "Total Non-Billable",
    confirm_delete_expense: "Are you sure you want to delete this expense entry?",
    no_expenses_yet: "No expenses recorded for this project.",

    // Documents
    documents_title: "Project Documents",
    documents_subtitle: "Uploaded project files, requirements, contracts, and deliverables",
    upload_document: "Upload Document",
    doc_title: "Document Title",
    doc_title_placeholder: "e.g. Final Client Agreement v2",
    doc_category: "Category",
    doc_file: "File",
    doc_uploaded_by: "Uploaded By",
    doc_upload_date: "Upload Date",
    download_doc: "Download",
    confirm_delete_doc: "Are you sure you want to delete this document?",
    no_docs_yet: "No documents uploaded yet.",

    // Status Change Modal
    change_status_title: "Change Project Status",
    change_status_confirm_text: "Are you sure you want to change the status of this project to",
    change_status_btn: "Update Status",
    closed_project_badge: "Closed",

    // Settings: Project Options
    settings_project_options_title: "Project Configuration & Options",
    settings_project_options_subtitle: "Manage dynamic lookup options, sequence format, upload rules, and role permissions",
    settings_tab_statuses: "Statuses",
    settings_tab_priorities: "Priorities",
    settings_tab_billing: "Billing Methods",
    settings_tab_categories: "Document Categories",
    settings_tab_code_format: "Code Sequence Format",
    settings_tab_file_rules: "Upload Rules",
    settings_tab_permissions: "Role Permissions",
    add_option: "Add Option",
    edit_option: "Edit Option",
    option_name: "Option Name (English)",
    option_name_bn: "Bengali Label (Optional)",
    option_color: "Color Badge",
    option_is_default: "Default Option",
    option_is_active: "Active",
    option_in_use: "Used by records",
    badge_preview: "Live Badge Preview",
    warning_in_use_edit: "Warning: This option is currently assigned to existing project records.",
    deactivate_instead_of_delete: "In-use options cannot be deleted; deactivate them to prevent new selections.",
    code_prefix: "Prefix",
    code_digits: "Number of Digits",
    code_include_year: "Include Current Year Segment",
    code_preview: "Preview Next Code",
    receipt_allowed_ext: "Receipt Allowed File Extensions",
    receipt_max_size: "Receipt Max File Size (MB)",
    doc_allowed_ext: "Document Allowed File Extensions",
    doc_max_size: "Document Max File Size (MB)",
    perm_role: "Role",
    perm_can_view: "View Projects",
    perm_can_create: "Create Projects",
    perm_can_edit: "Edit Projects",
    perm_can_delete: "Delete Projects",
    perm_can_expenses: "Manage Expenses",
    perm_can_documents: "Manage Documents",
    perm_can_modules: "Manage Modules",
    perm_can_status: "Change Status",
    perm_can_config: "Manage Configuration",
    admin_perms_locked: "Admin permissions are fully enabled and non-removable.",
  },

  bn: {
    // Navigation
    nav_projects: "প্রকল্পসমূহ (Projects)",
    nav_new_project: "নতুন প্রকল্প",

    // Project List
    projects_title: "প্রকল্পসমূহ",
    projects_subtitle: "গ্রাহক প্রকল্প, বাজেট, মডিউল, খরচ এবং ডকুমেন্টস পর্যবেক্ষণ করুন",
    search_placeholder: "কোড, প্রকল্পের নাম, ক্লায়েন্ট খুঁজুন...",
    filter_all_statuses: "সকল স্ট্যাটাস",
    filter_all_priorities: "সকল অগ্রাধিকার",
    filter_all_billing: "সকল বিলিং পদ্ধতি",
    filter_all_clients: "সকল ক্লায়েন্ট",
    filter_open_projects: "চলমান প্রকল্প",
    filter_closed_projects: "সমাপ্ত প্রকল্প",
    filter_all_lifecycle: "সকল প্রকল্প (চলমান ও সমাপ্ত)",
    filter_from_date: "শুরুর তারিখ",
    filter_to_date: "শেষের তারিখ",
    clear_filters: "ফিল্টার মুছুন",
    no_projects_found: "কোন প্রকল্প পাওয়া যায়নি",
    no_projects_desc: "আপনার প্রথম প্রকল্প তৈরি করে শুরু করুন।",
    create_first_project: "নতুন প্রকল্প তৈরি করুন",
    total_projects_count: "মোট প্রকল্প",

    // Columns
    col_code: "প্রকল্প কোড",
    col_name: "প্রকল্পের নাম",
    col_client: "ক্লায়েন্ট",
    col_timespan: "সময়কাল",
    col_status: "স্ট্যাটাস",
    col_priority: "অগ্রাধিকার",
    col_budget: "বাজেট",
    col_actual_cost: "প্রকৃত ব্যয়",
    col_documents: "ডকুমেন্টস",
    col_billing_method: "বিলিং পদ্ধতি",
    col_comment: "মন্তব্য",
    col_created_date: "তৈরির তারিখ",
    col_actions: "পদক্ষেপ",

    // Values & Common
    not_set: "নির্ধারিত নয়",
    ongoing: "চলমান",
    days: "দিন",
    view_details: "বিস্তারিত দেখুন",
    edit_project: "সম্পাদনা করুন",
    delete_project: "প্রকল্প মুছুন",
    confirm_delete_project: "আপনি কি নিশ্চিত যে এই প্রকল্পটি মুছতে চান? শুধুমাত্র খরচ বা ডকুমেন্ট ছাড়া প্রকল্প মোছা যাবে।",
    loading: "লোড হচ্ছে...",
    saving: "সংরক্ষণ করা হচ্ছে...",
    save_changes: "পরিবর্তন সংরক্ষণ করুন",
    cancel: "বাতিল",
    confirm: "নিশ্চিত করুন",
    back_to_projects: "প্রকল্প তালিকায় ফিরে যান",

    // Project Form
    form_create_title: "নতুন প্রকল্প তৈরি করুন",
    form_create_subtitle: "বাজেট ও লক্ষ্যসহ একটি নতুন ক্লায়েন্ট প্রকল্প শুরু করুন",
    form_edit_title: "প্রকল্প সম্পাদনা",
    form_edit_subtitle: "প্রকল্পের তথ্য ও সেটিংস হালনাগাদ করুন",
    field_project_name: "প্রকল্পের নাম",
    field_project_name_placeholder: "যেমন: ইআরপি সিস্টেম ফেজ ১",
    field_client: "ক্লায়েন্ট",
    field_client_placeholder: "ক্লায়েন্ট নির্বাচন করুন...",
    field_status: "প্রকল্পের স্ট্যাটাস",
    field_priority: "অগ্রাধিকার",
    field_billing_method: "বিলিং পদ্ধতি",
    field_start_date: "শুরুর তারিখ",
    field_end_date: "সমাপ্তির তারিখ (ঐচ্ছিক)",
    field_total_budget: "মোট বাজেট",
    field_estimated_cost: "আনুমানিক খরচ",
    field_description: "বিবরণ",
    field_description_placeholder: "প্রকল্পের উদ্দেশ্য এবং কাজের বিবরণ...",
    field_comment: "অভ্যন্তরীণ মন্তব্য",
    field_comment_placeholder: "টিমের জন্য ব্যক্তিগত নোট...",
    error_name_required: "প্রকল্পের নাম আবশ্যক।",
    error_client_required: "ক্লায়েন্ট নির্বাচন আবশ্যক।",
    error_end_date_before_start: "শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।",

    // Project Details
    details_tab_overview: "সারসংক্ষেপ",
    details_tab_modules: "মডিউল ও অগ্রগতি",
    details_tab_budget: "বাজেট ও খরচ",
    details_tab_expenses: "ব্যয়সমূহ",
    details_tab_documents: "ডকুমেন্টস",

    // Budget Cards
    card_total_budget: "মোট বাজেট",
    card_used_budget: "ব্যবহৃত বাজেট",
    card_remaining_budget: "অবশিষ্ট বাজেট",
    card_estimated_cost: "আনুমানিক ব্যয়",
    card_actual_cost: "প্রকৃত ব্যয়",
    budget_usage: "বাজেট খরচ",
    over_budget_warning: "সতর্কবার্তা: নির্ধারিত বাজেটের অতিরিক্ত ব্যয় হয়েছে!",
    budget_healthy: "বাজেট নিয়ন্ত্রণে রয়েছে।",

    // Modules
    modules_title: "কাজের মডিউল ও মাইলফলক",
    modules_subtitle: "কাজের অংশ এবং তাদের সমাপ্তির অগ্রগতি",
    add_module: "মডিউল যোগ করুন",
    edit_module: "মডিউল সম্পাদনা",
    delete_module: "মডিউল মুছুন",
    module_name: "মডিউলের নাম",
    module_name_placeholder: "যেমন: ডাটাবেজ ডিজাইন",
    module_progress: "অগ্রগতি",
    module_sort_order: "ক্রম",
    confirm_delete_module: "আপনি কি নিশ্চিত যে এই মডিউলটি মুছে ফেলতে চান?",
    no_modules_yet: "এখনও কোন মডিউল যুক্ত করা হয়নি।",
    overall_progress: "সামগ্রিক অগ্রগতি",

    // Expenses
    expenses_title: "প্রকল্পের ব্যয়সমূহ",
    expenses_subtitle: "এই প্রকল্পের জন্য লিপিবদ্ধ খরচ",
    add_expense: "ব্যয় যোগ করুন",
    expense_name: "ব্যয়ের বিবরণ",
    expense_name_placeholder: "যেমন: ডোমেন নবায়ন, সার্ভার বিল",
    expense_amount: "পরিমাণ",
    expense_date: "তারিখ",
    expense_billable: "ক্লায়েন্টের জন্য বিলযোগ্য",
    expense_non_billable: "অভ্যন্তরীণ ব্যয়",
    expense_receipt: "রশিদ / ইনভয়েস ফাইল",
    view_receipt: "রশিদ দেখুন",
    download_receipt: "রশিদ ডাউনলোড",
    no_receipt: "রশিদ নেই",
    total_billable: "মোট বিলযোগ্য",
    total_non_billable: "মোট অবিলযোগ্য",
    confirm_delete_expense: "আপনি কি এই ব্যয়ের রেকর্ডটি মুছে ফেলতে চান?",
    no_expenses_yet: "কোন ব্যয় লিপিবদ্ধ করা হয়নি।",

    // Documents
    documents_title: "প্রকল্পের ডকুমেন্টস",
    documents_subtitle: "আপলোডকৃত ফাইল, চুক্তিপত্র এবং রিপোর্ট",
    upload_document: "ডকুমেন্ট আপলোড",
    doc_title: "ডকুমেন্টের শিরোনাম",
    doc_title_placeholder: "যেমন: চুক্তিপত্র",
    doc_category: "ক্যাটাগরি",
    doc_file: "ফাইল",
    doc_uploaded_by: "আপলোডকারী",
    doc_upload_date: "আপলোডের তারিখ",
    download_doc: "ডাউনলোড",
    confirm_delete_doc: "আপনি কি এই ডকুমেন্টটি মুছে ফেলতে চান?",
    no_docs_yet: "কোন ডকুমেন্ট আপলোড করা হয়নি।",

    // Status Change
    change_status_title: "প্রকল্পের স্ট্যাটাস পরিবর্তন",
    change_status_confirm_text: "আপনি কি নিশ্চিত যে এই প্রকল্পের স্ট্যাটাস পরিবর্তন করবেন",
    change_status_btn: "স্ট্যাটাস পরিবর্তন করুন",
    closed_project_badge: "সমাপ্ত",

    // Settings
    settings_project_options_title: "প্রকল্প সেটিংস ও অপশনসমূহ",
    settings_project_options_subtitle: "ডায়নামিক অপশন, কোড ফরম্যাট, ফাইল নিয়ম এবং অনুমতি নিয়ন্ত্রণ",
    settings_tab_statuses: "স্ট্যাটাসসমূহ",
    settings_tab_priorities: "অগ্রাধিকারসমূহ",
    settings_tab_billing: "বিলিং পদ্ধতিসমূহ",
    settings_tab_categories: "ডকুমেন্ট ক্যাটাগরি",
    settings_tab_code_format: "কোড ফরম্যাট",
    settings_tab_file_rules: "ফাইলের নিয়ম",
    settings_tab_permissions: "ভূমিকাভিত্তিক অনুমতি",
    add_option: "অপশন যোগ করুন",
    edit_option: "অপশন সম্পাদনা",
    option_name: "নাম (ইংরেজি)",
    option_name_bn: "বাংলা নাম (ঐচ্ছিক)",
    option_color: "রঙের ব্যাজ",
    option_is_default: "ডিফল্ট",
    option_is_active: "সক্রিয়",
    option_in_use: "ব্যবহারকারী রেকর্ড",
    badge_preview: "ব্যাজ প্রিভিউ",
    warning_in_use_edit: "সতর্কতা: এই অপশনটি বিদ্যমান প্রকল্পে ব্যবহৃত হচ্ছে।",
    deactivate_instead_of_delete: "ব্যবহৃত অপশন মোছা যাবে না; নিষ্ক্রিয় করতে পারেন।",
    code_prefix: "প্রিফিক্স",
    code_digits: "সংখ্যার ডিজিট",
    code_include_year: "বর্তমান সাল যুক্ত করুন",
    code_preview: "পরবর্তী কোড প্রিভিউ",
    receipt_allowed_ext: "রশিদের অনুমোদিত ফাইল ফরম্যাট",
    receipt_max_size: "রশিদের সর্বোচ্চ আকার (মেগাবাইট)",
    doc_allowed_ext: "ডকুমেন্টের অনুমোদিত ফাইল ফরম্যাট",
    doc_max_size: "ডকুমেন্টের সর্বোচ্চ আকার (মেগাবাইট)",
    perm_role: "ভূমিকা (Role)",
    perm_can_view: "প্রকল্প দেখতে পারবে",
    perm_can_create: "প্রকল্প তৈরি করতে পারবে",
    perm_can_edit: "প্রকল্প সম্পাদনা করতে পারবে",
    perm_can_delete: "প্রকল্প মুছতে পারবে",
    perm_can_expenses: "ব্যয় নিয়ন্ত্রণ",
    perm_can_documents: "ডকুমেন্ট নিয়ন্ত্রণ",
    perm_can_modules: "মডিউল নিয়ন্ত্রণ",
    perm_can_status: "স্ট্যাটাস পরিবর্তন",
    perm_can_config: "কনফিগারেশন নিয়ন্ত্রণ",
    admin_perms_locked: "অ্যাডমিন অনুমতি সবসময় সম্পূর্ণ এবং অপরিবর্তনীয়।",
  },
};

export type TranslationKey = keyof typeof translations.en;

/**
 * Translation helper function: returns the localized text for a key.
 */
export function t(key: TranslationKey, lang: "en" | "bn" = "en"): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || String(key);
}

/**
 * Format currency amount with currency symbol
 */
export function formatCurrency(amount: string | number | null | undefined, symbol: string = ""): string {
  if (amount === null || amount === undefined || amount === "") return symbol ? `0.00 ${symbol}` : "0.00";
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(num)) return symbol ? `0.00 ${symbol}` : "0.00";
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format date string safely
 */
export function formatDate(dateStr: string | null | undefined, fallback: string = "-"): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return fallback;
  }
}
