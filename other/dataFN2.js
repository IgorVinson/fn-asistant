window.work_order = {
    "id": 16219367,
    "networks": {
        "metadata": {"total": 1, "per_page": 1, "pages": 1, "page": 1}, "actions": [], "results": [{
            "id": 1,
            "name": "Field Nation",
            "type": "marketplace",
            "options": [{
                "id": 5,
                "name": "Buyer Flat Fee",
                "type": "decimal",
                "description": "Flat fee per job (buyer fee)",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 3,
                "name": "Service Fee Rate",
                "type": "decimal",
                "description": "Percentage of job total (provider fee)",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "10",
                "default_value": "10",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 2,
                "name": "Buyer Percentage of Service Fee",
                "type": "percent",
                "description": "Buyer share of % fee",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 19,
                "name": "Buyer Service Fee Cap",
                "type": "decimal",
                "description": "Buyer service fee cap",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 20,
                "name": "Provider Service Fee Cap",
                "type": "decimal",
                "description": "Provider service fee cap",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 8,
                "name": "Field Nation Processes Payments",
                "type": "checkbox",
                "description": "Process provider payments through Field Nation",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 26,
                "name": "Constant Hourly Rate",
                "type": "decimal",
                "description": "Use constant hourly rate",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 4,
                "name": "FN Insurance Program",
                "type": "checkbox",
                "description": "Apply Field Nation insurance fee if provider does not have insurance",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 24,
                "name": "Insurance Required",
                "type": "checkbox",
                "description": "Insurance is required to become eligible (this option works in tandem with FN Insurance Program)",
                "category": "settings",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 30,
                "name": "Work order pay types",
                "type": "text",
                "description": "Work order pay types",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "blended,fixed,hourly,per_device",
                "default_value": "blended,fixed,hourly,per_device",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 31,
                "name": "Work order minimum hourly pay rate",
                "type": "decimal",
                "description": "Work order minimum hourly pay rate",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "",
                "default_value": "",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 6,
                "name": "Hide Ratings",
                "type": "checkbox",
                "description": "Disable providers from seeing and providing ratings",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 7,
                "name": "Direct Assign",
                "type": "checkbox",
                "description": "Allow direct assignment of providers",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 14,
                "name": "Allow Auto Swap",
                "type": "checkbox",
                "description": "Disable provider swap confirmation",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 15,
                "name": "Disable PQAP",
                "type": "checkbox",
                "description": "Disable Provider Quality Assurance Program (PQAP) processes",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 13,
                "name": "Join Other Networks",
                "type": "checkbox",
                "description": "Allow providers to join other networks.",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 27,
                "name": "Must be used as the exclusive network on work orders",
                "type": "checkbox",
                "description": "Must be used as the exclusive network on work orders",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 28,
                "name": "Restrict access for newly added users",
                "type": "checkbox",
                "description": "Restrict access for newly added users",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 32,
                "name": "Timesheet Tracking",
                "type": "checkbox",
                "description": "Hours on the work orders are tracked for timesheet",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 29,
                "name": "Use specific onboarding flow",
                "type": "text",
                "description": "Use specific onboarding flow",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "none",
                "default_value": "none",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 21,
                "name": "Buy from Network",
                "type": "checkbox",
                "description": "Allow company to buy from network",
                "category": "company_permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 22,
                "name": "Perform Work",
                "type": "checkbox",
                "description": "Allow company to complete work in network",
                "category": "company_permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 23,
                "name": "Invite Talent",
                "type": "checkbox",
                "description": "Allow company to invite talent to network",
                "category": "company_permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }],
            "company_options": [],
            "sourced_providers": [],
            "actions": []
        }], "active": {
            "id": 1,
            "name": "Field Nation",
            "type": "marketplace",
            "options": [{
                "id": 5,
                "name": "Buyer Flat Fee",
                "type": "decimal",
                "description": "Flat fee per job (buyer fee)",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 3,
                "name": "Service Fee Rate",
                "type": "decimal",
                "description": "Percentage of job total (provider fee)",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "10",
                "default_value": "10",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 2,
                "name": "Buyer Percentage of Service Fee",
                "type": "percent",
                "description": "Buyer share of % fee",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 19,
                "name": "Buyer Service Fee Cap",
                "type": "decimal",
                "description": "Buyer service fee cap",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 20,
                "name": "Provider Service Fee Cap",
                "type": "decimal",
                "description": "Provider service fee cap",
                "category": "payment_fees",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 8,
                "name": "Field Nation Processes Payments",
                "type": "checkbox",
                "description": "Process provider payments through Field Nation",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 26,
                "name": "Constant Hourly Rate",
                "type": "decimal",
                "description": "Use constant hourly rate",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 4,
                "name": "FN Insurance Program",
                "type": "checkbox",
                "description": "Apply Field Nation insurance fee if provider does not have insurance",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 24,
                "name": "Insurance Required",
                "type": "checkbox",
                "description": "Insurance is required to become eligible (this option works in tandem with FN Insurance Program)",
                "category": "settings",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 30,
                "name": "Work order pay types",
                "type": "text",
                "description": "Work order pay types",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "blended,fixed,hourly,per_device",
                "default_value": "blended,fixed,hourly,per_device",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 31,
                "name": "Work order minimum hourly pay rate",
                "type": "decimal",
                "description": "Work order minimum hourly pay rate",
                "category": "settings",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "",
                "default_value": "",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 6,
                "name": "Hide Ratings",
                "type": "checkbox",
                "description": "Disable providers from seeing and providing ratings",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 7,
                "name": "Direct Assign",
                "type": "checkbox",
                "description": "Allow direct assignment of providers",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 14,
                "name": "Allow Auto Swap",
                "type": "checkbox",
                "description": "Disable provider swap confirmation",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 15,
                "name": "Disable PQAP",
                "type": "checkbox",
                "description": "Disable Provider Quality Assurance Program (PQAP) processes",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 13,
                "name": "Join Other Networks",
                "type": "checkbox",
                "description": "Allow providers to join other networks.",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 27,
                "name": "Must be used as the exclusive network on work orders",
                "type": "checkbox",
                "description": "Must be used as the exclusive network on work orders",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 28,
                "name": "Restrict access for newly added users",
                "type": "checkbox",
                "description": "Restrict access for newly added users",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 32,
                "name": "Timesheet Tracking",
                "type": "checkbox",
                "description": "Hours on the work orders are tracked for timesheet",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff_admin",
                "value": "0",
                "default_value": "0",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 29,
                "name": "Use specific onboarding flow",
                "type": "text",
                "description": "Use specific onboarding flow",
                "category": "permissions",
                "visibility": "all",
                "editable": "staff,staff_admin",
                "value": "none",
                "default_value": "none",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 21,
                "name": "Buy from Network",
                "type": "checkbox",
                "description": "Allow company to buy from network",
                "category": "company_permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 22,
                "name": "Perform Work",
                "type": "checkbox",
                "description": "Allow company to complete work in network",
                "category": "company_permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }, {
                "id": 23,
                "name": "Invite Talent",
                "type": "checkbox",
                "description": "Allow company to invite talent to network",
                "category": "company_permissions",
                "visibility": "all",
                "editable": "staff,buyer,staff_admin",
                "value": "1",
                "default_value": "1",
                "network_option_role": "provider",
                "actions": []
            }],
            "company_options": [],
            "sourced_providers": [],
            "actions": []
        }
    },
    "attachments": {
        "correlation_id": "0469d74ce234ee175823e76c94e4833ed10f5a0b",
        "actions": [],
        "sum": {"unreviewed": 0},
        "metadata": {"total": 2, "per_page": 2, "pages": 1, "page": 1},
        "results": [{
            "id": 1,
            "name": "Documents",
            "type": "document",
            "task": {"id": 0, "type": {"id": 0}},
            "actions": [],
            "metadata": {"total": 1, "per_page": 1, "pages": 1, "page": 1},
            "results": [{
                "id": 3717582,
                "author": {
                    "id": 813866,
                    "first_name": "Ashley",
                    "last_name": "Morrow",
                    "thumbnail": "\/images\/missing-profile.png",
                    "phone": ""
                },
                "created": {"utc": "2024-10-29 16:58:02", "local": {"date": "2024-10-29", "time": "12:58:02"}},
                "time_zone": {"name": "America\/New_York", "short": "EDT"},
                "file": {
                    "mime": "application\/pdf",
                    "thumbnail": "",
                    "name": "Mars Gatekeeper Field Guide v1.4.pdf",
                    "size_bytes": 1817500,
                    "link": "https:\/\/fieldnation.s3.amazonaws.com\/documents\/company-60191\/docs_3717582_3732249.pdf?AWSAccessKeyId=AKIAWPC4BGCUMUC7SWFR&Expires=1733675154&Signature=N51mDWnPkyj6BvIevclG3cgrFyo%3D",
                    "type": "file",
                    "icon": "icon-file-pdf"
                },
                "show_before_assignment": false,
                "task": {"id": 0},
                "notes": "",
                "actions": ["view"]
            }]
        }, {
            "id": 38572175,
            "name": "Misc",
            "min_files": 0,
            "max_files": 999,
            "min_bytes": 1,
            "max_bytes": 104857600,
            "type": "slot",
            "task": {"id": 0},
            "expense": false,
            "actions": ["upload"],
            "metadata": {"total": 0, "per_page": 0, "pages": 1, "page": 1},
            "results": []
        }]
    },
    "shipments": {
        "metadata": {"total": 0, "per_page": 0, "pages": 1, "page": 1},
        "results": [],
        "correlation_id": "fa2c20033a4cfd5b61a0837ee941623830ff0169",
        "actions": ["add"]
    },
    "signatures": {
        "metadata": {"total": 0, "per_page": 1, "page": 1, "pages": 1},
        "correlation_id": "4ace50bc054afe44e21637cda17576c3630b1f4f",
        "actions": ["add"],
        "results": []
    },
    "time_logs": {
        "actions": [],
        "hours": 0,
        "metadata": {"total": 0, "pages": 1, "per_page": 0, "page": 1},
        "results": [],
        "correlation_id": "d5f834b0b226aff595fca5117c83e4b439322fd2"
    },
    "problems": {
        "metadata": {"total": 0, "per_page": 1, "page": 1, "pages": 1},
        "sum": {"active": 0, "resolved": 0},
        "correlation_id": "35c8e860dd853e2406307b6e8b317be84b6899e6",
        "actions": ["add"],
        "types": [{
            "id": 14,
            "name": "Buyer unresponsive",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": true,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": true,
            "send_to_accounting": false,
            "children": [],
            "has_other": false
        }, {
            "id": 48,
            "name": "How to\/Technical assistance",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": true,
            "send_to_buyer": false,
            "send_to_provider": true,
            "send_to_support": true,
            "send_to_accounting": false,
            "children": [],
            "has_other": false
        }, {
            "id": 49,
            "name": "Work order clarification needed",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [],
            "has_other": false
        }, {
            "id": 50,
            "name": "Schedule needs updating ",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [],
            "has_other": false
        }, {
            "id": 51,
            "name": "I'm onsite - can't complete work",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [{
                "id": 59,
                "name": "Site contact not available\/unable to reach",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 60,
                "name": "Other work needs to be completed prior to my work",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 61,
                "name": "I do not have access to the area",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 62,
                "name": "Site not ready\/as described",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }],
            "has_other": false
        }, {
            "id": 52,
            "name": "Reached max hours - need more time approved",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [],
            "has_other": false
        }, {
            "id": 53,
            "name": "Shipment information needed",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [{
                "id": 63,
                "name": "Delivery\/Tracking",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 64,
                "name": "Return plan\/timeline",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }],
            "has_other": false
        }, {
            "id": 56,
            "name": "I need a response from someone ",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [{
                "id": 69,
                "name": "Site contact ",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 70,
                "name": "Help desk\/Onsite support",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 71,
                "name": "Work order manager\/Buyer contact ",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }],
            "has_other": false
        }, {
            "id": 57,
            "name": "I can't make it to my assignment",
            "performance_event": false,
            "show_pqap_warning": false,
            "reportable": true,
            "message": "",
            "support_ticket": false,
            "send_to_buyer": true,
            "send_to_provider": true,
            "send_to_support": false,
            "send_to_accounting": false,
            "children": [{
                "id": 108,
                "name": "I am sick\/injured or have been exposed to COVID.",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": false
            }, {
                "id": 113,
                "name": "Schedule changed and I am no longer available",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "0",
                "has_other": false
            }, {
                "id": 114,
                "name": "Scope of work changed and I am no longer able to complete this work order",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "0",
                "has_other": false
            }, {
                "id": 109,
                "name": "Other",
                "performance_event": false,
                "show_pqap_warning": false,
                "reportable": true,
                "message": "",
                "support_ticket": false,
                "send_to_buyer": true,
                "send_to_provider": true,
                "send_to_support": false,
                "send_to_accounting": false,
                "available_for_private_networks": "1",
                "has_other": true
            }],
            "has_other": false
        }],
        "results": []
    },
    "pay": {
        "work_order_id": 16219367,
        "type": "blended",
        "base": {"units": 2, "amount": 110},
        "additional": {"units": 4, "amount": 55},
        "fees": [{
            "name": "cancellation",
            "id": 0,
            "amount": 0,
            "queued": false,
            "charged": false,
            "hours24_applicable": false,
            "calculation": "fixed",
            "at_risk": false
        }, {
            "name": "provider",
            "amount": 11,
            "calculation": "percent",
            "modifier": 0.1,
            "charged": false,
            "min_amount": 11,
            "max_amount": 33,
            "display_name": "Field Nation Service Fee",
            "description": "Field Nation Service Charge of 10%. This service charge helps us operate Field Nation.",
            "breakdown": null
        }, {
            "name": "Provider Fee Pro",
            "display_name": "Field Nation Service Fee",
            "amount": 4.29,
            "max_amount": 12.87,
            "calculation": "percent",
            "description": "Field Nation Service Charge of 10% and additional Service Charge of 3.9% with Field Nation Pro. This service charge helps us operate Field Nation.",
            "modifier": 0.039,
            "breakdown": null
        }],
        "payment": {
            "id": 62345690,
            "amount": 330,
            "charged": false,
            "date": {"utc": "", "local": {"date": "", "time": ""}}
        },
        "client_payment_enabled": false,
        "client_payment_terms": 0,
        "hours": 6,
        "buyer_overall_jobs": 17633,
        "can_view": true,
        "buyer_approval_time_days": 3,
        "client_payment_terms_copy": "Payment will be processed Friday after approval",
        "client_payment_terms_updated_copy": "(processed on the Friday following Work Order approval)",
        "target_review_period": 7,
        "reported_hours": 0,
        "number_of_devices": 0,
        "hold": {"id": 62345690, "amount": 330, "charged": true},
        "minimum_payment": 20,
        "range": {"min": 110, "max": 330},
        "actions": ["has_range"],
        "labor_sum": 110,
        "fees_cancellation_pending": false,
        "passive_cancellation_amount": 30,
        "fee_cancellation_queued": "0",
        "fee_cancellation_charged": "0",
        "status_id": "3",
        "correlation_id": "384470ef11775c44d4d7bfe7fe29722dccbc9650",
        "bonuses": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "sum": {"all": 0, "charged": 0, "uncharged": 0},
            "results": [],
            "actions": []
        },
        "expenses": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "sum": {
                "all": 0,
                "charged": 0,
                "uncharged": 0,
                "pending": 0,
                "approved": 0,
                "approved_amount": 0,
                "denied": 0
            },
            "results": [],
            "actions": ["add"]
        },
        "penalties": {
            "metadata": {"total": 2, "per_page": 2, "page": 1, "pages": 1},
            "sum": {"all": 22, "charged": 0, "uncharged": 22},
            "results": [{
                "id": 1385,
                "charged": false,
                "calculation": "percent",
                "modifier": 10,
                "name": "Late check in",
                "description": "Provider late may result in 10% deduction.",
                "status_reason": "",
                "updated_by": "",
                "updated_at": {"local": {"date": "", "time": ""}, "utc": ""},
                "amount": 11,
                "selected": true,
                "actions": []
            }, {
                "id": 1444,
                "charged": false,
                "calculation": "percent",
                "modifier": 10,
                "name": "Un-Prepared",
                "description": "Unprepared for work, not having proper tools, not completing pre-onsite tasks.",
                "status_reason": "",
                "updated_by": "",
                "updated_at": {"local": {"date": "", "time": ""}, "utc": ""},
                "amount": 11,
                "selected": true,
                "actions": []
            }],
            "actions": []
        },
        "discounts": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "sum": {"all": 0},
            "results": [],
            "actions": ["add"]
        },
        "increases": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "minimum": 20,
            "sum": {"all": 0},
            "results": [],
            "actions": ["add"]
        },
        "positive": true,
        "currency_style": "positive",
        "max_pay": 330,
        "total": 99,
        "max_pay_limit": 284.13,
        "fn_process_payment": "1",
        "total_by_role": 94.71,
        "total_before_fees_by_role": 110,
        "calculated_total": {"total": {"min": 94.71, "max": 94.71}},
        "is_taxable_location": true
    },
    "pay_old": {
        "work_order_id": 16219367,
        "type": "blended",
        "base": {"units": 2, "amount": 110},
        "additional": {"units": 4, "amount": 55},
        "fees": [{
            "name": "cancellation",
            "id": 0,
            "amount": 0,
            "queued": false,
            "charged": false,
            "hours24_applicable": false,
            "calculation": "fixed",
            "at_risk": false
        }, {
            "name": "provider",
            "amount": 11,
            "calculation": "percent",
            "modifier": 0.1,
            "charged": false,
            "min_amount": 11,
            "max_amount": 33,
            "display_name": "Field Nation Service Fee"
        }],
        "payment": {
            "id": 62345690,
            "amount": 330,
            "charged": false,
            "date": {"utc": "", "local": {"date": "", "time": ""}}
        },
        "finance": {
            "id": 549,
            "terms": "7",
            "description": "Net 7 ACH - Push",
            "limit": 1700000,
            "invoiced_account": true
        },
        "client_payment_enabled": false,
        "client_payment_terms": 0,
        "hours": 6,
        "buyer_overall_jobs": 17633,
        "can_view": true,
        "buyer_approval_time_days": 3,
        "client_payment_terms_copy": "Payment will be processed Friday after approval",
        "client_payment_terms_updated_copy": "(processed on the Friday following Work Order approval)",
        "target_review_period": 7,
        "reported_hours": 0,
        "number_of_devices": 0,
        "hold": {"id": 62345690, "amount": 330, "charged": true},
        "minimum_payment": 20,
        "range": {"min": 110, "max": 330},
        "actions": ["has_range"],
        "labor_sum": 110,
        "fees_cancellation_pending": false,
        "passive_cancellation_amount": 30,
        "fee_cancellation_queued": "0",
        "fee_cancellation_charged": "0",
        "status_id": "3",
        "correlation_id": "384470ef11775c44d4d7bfe7fe29722dccbc9650",
        "bonuses": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "sum": {"all": 0, "charged": 0, "uncharged": 0},
            "results": [],
            "actions": []
        },
        "expenses": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "sum": {
                "all": 0,
                "charged": 0,
                "uncharged": 0,
                "pending": 0,
                "approved": 0,
                "approved_amount": 0,
                "denied": 0
            },
            "results": [],
            "actions": ["add"]
        },
        "penalties": {
            "metadata": {"total": 2, "per_page": 2, "page": 1, "pages": 1},
            "sum": {"all": 22, "charged": 0, "uncharged": 22},
            "results": [{
                "id": 1385,
                "charged": false,
                "calculation": "percent",
                "modifier": 10,
                "name": "Late check in",
                "description": "Provider late may result in 10% deduction.",
                "status_reason": "",
                "updated_by": "",
                "updated_at": {"local": {"date": "", "time": ""}, "utc": ""},
                "amount": 11,
                "selected": true,
                "actions": []
            }, {
                "id": 1444,
                "charged": false,
                "calculation": "percent",
                "modifier": 10,
                "name": "Un-Prepared",
                "description": "Unprepared for work, not having proper tools, not completing pre-onsite tasks.",
                "status_reason": "",
                "updated_by": "",
                "updated_at": {"local": {"date": "", "time": ""}, "utc": ""},
                "amount": 11,
                "selected": true,
                "actions": []
            }],
            "actions": []
        },
        "discounts": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "sum": {"all": 0},
            "results": [],
            "actions": ["add"]
        },
        "increases": {
            "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
            "minimum": 20,
            "sum": {"all": 0},
            "results": [],
            "actions": ["add"]
        },
        "positive": true,
        "currency_style": "positive",
        "max_pay": 330,
        "total": 99,
        "max_pay_limit": 330,
        "fn_process_payment": "1",
        "total_by_role": 99,
        "total_before_fees_by_role": 110,
        "calculated_total": {"total": {"min": 99, "max": 297}}
    },
    "pay_service": {
        "workOrderId": 16219367,
        "userId": 983643,
        "lineItems": [{
            "name": "labor",
            "amount": 110,
            "description": "",
            "accounting_code": 518,
            "key": "labor"
        }, {
            "name": "expenses",
            "amount": 0,
            "description": "",
            "accounting_code": 0,
            "key": "expenses"
        }, {
            "name": "discounts",
            "amount": 0,
            "description": "",
            "accounting_code": 518,
            "key": "discounts"
        }, {
            "name": "bonuses",
            "amount": 0,
            "description": "",
            "accounting_code": 518,
            "key": "bonuses"
        }, {
            "name": "penalties",
            "amount": 0,
            "description": "",
            "accounting_code": 518,
            "key": "penalties"
        }, {
            "name": "Field Nation Service Fee",
            "amount": 11,
            "description": "",
            "accounting_code": 434,
            "key": "service_fee"
        }, {
            "name": "Provider Fee Pro",
            "amount": 4.29,
            "description": "",
            "accounting_code": 435,
            "key": "service_fee_pro"
        }, {
            "name": "General Liability Liaison",
            "amount": 0,
            "description": "",
            "accounting_code": 459,
            "key": "general_liability_liaison"
        }, {
            "name": "Transaction Value Tax",
            "amount": 0,
            "description": "",
            "accounting_code": 535,
            "key": "gtv_state_tax"
        }],
        "fees": {
            "buyer": [{
                "name": "General Liability Liaison",
                "key": "general_liability_liaison",
                "description": "Work orders that have General Liability Liaison insurance include an additional 0% charge on the total value of the work order.",
                "attributes": [],
                "percentCharge": 0,
                "actual": 0,
                "maximum": 0,
                "guarantee": 0
            }, {
                "name": "Transaction Value Tax",
                "key": "gtv_state_tax",
                "attributes": [],
                "percentCharge": 7.25,
                "breakdown": [{"percent": 4.75, "name": "NC STATE TAX", "amount": 0}, {
                    "percent": 2,
                    "name": "NC COUNTY TAX",
                    "amount": 0
                }, {"percent": 0.5, "name": "NC SPECIAL TAX", "amount": 0}],
                "taxableAmount": 0,
                "serviceRef": "gtv",
                "actual": 0,
                "maximum": 0,
                "guarantee": 0,
                "taxCalculated": 0,
                "exemptAmount": 7.98,
                "exemptCertId": 35064511,
                "isExemptOverride": false
            }],
            "provider": [{
                "name": "Field Nation Service Fee",
                "key": "service_fee",
                "description": "Field Nation Service Charge of 10%. This service charge helps us operate Field Nation.",
                "attributes": [],
                "percentCharge": 10,
                "actual": 11,
                "maximum": 33,
                "guarantee": 33
            }, {
                "name": "Provider Fee Pro",
                "key": "service_fee_pro",
                "description": "Field Nation Service Charge of 10% and additional Service Charge of 3.9% with Field Nation Pro. This service charge helps us operate Field Nation.",
                "attributes": [],
                "percentCharge": 3.9,
                "actual": 4.29,
                "maximum": 12.87,
                "guarantee": 12.87
            }]
        },
        "totals": {
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 94.71, "maximum": 284.13, "actual": 94.71, "guarantee": 284.13}
        },
        "ledger": [{
            "note": "hours logged value 0 too low, using 1",
            "buyer": {"minimum": 0, "maximum": 0, "actual": 0, "guarantee": 0},
            "provider": {"minimum": 0, "maximum": 0, "actual": 0, "guarantee": 0}
        }, {
            "note": "Labor item is added with code 518",
            "buyer": {"minimum": 0, "maximum": 0, "actual": 0, "guarantee": 0},
            "provider": {"minimum": 0, "maximum": 0, "actual": 0, "guarantee": 0}
        }, {
            "note": "Labor $110.00 fixed (for 2 hours) and 0 additional hours logged at $55.00\/hour",
            "buyer": {"minimum": 0, "maximum": 0, "actual": 110, "guarantee": 0},
            "provider": {"minimum": 0, "maximum": 0, "actual": 110, "guarantee": 0}
        }, {
            "note": "Labor minimum $110.00 fixed",
            "buyer": {"minimum": 110, "maximum": 0, "actual": 110, "guarantee": 0},
            "provider": {"minimum": 110, "maximum": 0, "actual": 110, "guarantee": 0}
        }, {
            "note": "Labor guarantee $110.00 fixed plus 4 hours at $55.00\/hour",
            "buyer": {"minimum": 110, "maximum": 0, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 0, "actual": 110, "guarantee": 330}
        }, {
            "note": "Labor maximum $110.00 fixed plus 4 hours at $55.00\/hour",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Minimum of all expenses against minimum possible labor",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum of all applied expenses against guaranteed labor",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum of all expenses against maximum possible labor",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Approved 0\/0 expenses for $0.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "hours logged value 0 too low, using 1",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Deduct discount $0.00 actual",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Possible discounts reduce minimum for labor from $110.00 to $110.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Possible discounts reduce maximum for labor from $330.00 to $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "hours logged value 0 too low, using 1",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Applied 0\/0 bonuses for $0.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee of bonuses against maximum possible labor (only in approved\/paid status)",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum of all applied bonuses against maximum possible labor",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "hours logged value 0 too low, using 1",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Applied 0\/2 penalties for $0.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum of all applied penalties reduces minimum pay",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum of all applied penalties against maximum possible labor",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Cancellation fee is not applicable for the work order",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "hours logged value 0 too low, using 1",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider contract is enabled. Adding provider service fee of 3.9% to current network fee",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider pays 10% service fee",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider pays 3.9% pro service fee",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "No buyer service fee applied on this work order",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider service fee of $11.00 applied from gross $110.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum provider service fee of $33.00 applied from maximum amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee provider service fee of $33.00 applied from guarantee amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee provider service fee of $33.00 applied from guarantee amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum provider service fee of $33.00 applied from maximum amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider service fee of $11.00 applied from gross $110.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider pro service fee of $4.29 applied from gross $110.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum provider pro service fee of $12.87 applied from maximum amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee provider pro service fee of $12.87 applied from guarantee amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee provider pro service fee of $12.87 applied from guarantee amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum provider pro service fee of $12.87 applied from maximum amount $330.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Provider pro service fee of $4.29 applied from gross $110.00",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Not applying buyer fee on workorder as contract does not have it enabled or is empty",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "No occupational accident insurance on workorder, not applying fee",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "No WA workers compensation on this workorder it does not meet the requirements",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "No high value supply on workorder, not applying fee.",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Not applying international fees as it is disabled on the platform.",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "No general liability charged: provider has verified GL insurance",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Not applying overage fee.",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "General Liability Liaison fee (0% of gross) of $0.00 added to buyer total as a charge",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "General Liability Liaison fee (0% of gross) of $0.00 added to buyer total as a charge",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "General Liability Liaison fee (0% of gross) of $0.00 added to buyer total as a charge",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "General Liability Liaison fee (0% of gross) of $0.00 added to buyer total as a charge",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "General Liability Liaison fee (0% of gross) of $0.00 added to buyer total as a charge",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "General Liability Liaison fee (0% of gross) of $0.00 added to buyer total as a charge",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Transaction value tax from accounting-code 518 has been added to work order",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "State tax fee of 7.25% gtv_actual",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum State tax fee of 7.25% gtv_maximum",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee State tax fee of 7.25% gtv_guarantee",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Guarantee State tax fee of 7.25% gtv_guarantee",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "Maximum State tax fee of 7.25% gtv_maximum",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }, {
            "note": "State tax fee of 7.25% gtv_actual",
            "buyer": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330},
            "provider": {"minimum": 110, "maximum": 330, "actual": 110, "guarantee": 330}
        }],
        "attributes": [{"type": "work_order", "name": "taxable_location", "value": "1"}, {
            "type": "work_order",
            "name": "buyer_taxable_location",
            "value": "1"
        }],
        "from_cache": true
    },
    "publish_stats": {
        "has_preferred_requests": true,
        "has_preferred_counters": false,
        "requests": 0,
        "counter_offers": 0,
        "routes": 0,
        "declines": 0,
        "all_requests": 8,
        "provider_metadata": {"requests": [], "counter_offers": [], "routes": []},
        "correlation_id": "0066f51fb5413c6e2e1354109cab493a553b6ecc"
    },
    "requests": {
        "metadata": {"total": 1, "per_page": 1, "page": 1, "pages": 1},
        "sum": {"all": 0},
        "results": [{
            "id": 42898496,
            "counter": false,
            "active": true,
            "notes": "",
            "created": {"utc": "2024-11-19 01:50:18", "local": {"date": "2024-11-18", "time": "20:50:18"}},
            "eta": {
                "start": {"utc": "2024-12-10 12:00:00", "local": {"date": "2024-12-10", "time": "07:00:00"}},
                "hour_estimate": 6
            },
            "technician": {
                "id": 983643,
                "first_name": "Ihor",
                "last_name": "Tiazhkorob",
                "thumbnail": "https:\/\/s3.amazonaws.com\/dev.fieldnation\/profile_image\/983643-66ecafef1083f.png"
            },
            "actions": [],
            "pay": {"range": {"min": 0, "max": 0}}
        }],
        "correlation_id": "cb46f41b999a9d27c6e5235e65f83117c80ecf32",
        "actions": []
    },
    "allow_counter_offers": true,
    "is_user_declined": false,
    "routes": {
        "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
        "sum": {"all": 0},
        "results": [],
        "actions": []
    },
    "declines": {
        "metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1},
        "sum": {"all": 0},
        "results": [],
        "actions": []
    },
    "custom_fields": {
        "actions": [],
        "internal": {"id": 15952, "name": "FP WO#", "value": "WO328953", "role": "buyer"},
        "metadata": {"total": 3, "pages": 1, "per_page": 3, "page": 1},
        "results": [{
            "id": 1,
            "name": "Untitled",
            "order": 1,
            "role": "buyer",
            "metadata": {"total": 3, "page": 1, "pages": 1, "per_page": 3},
            "results": [{
                "id": 18587,
                "name": "FP Job#",
                "tip": "Field Power Job #",
                "type": "text",
                "role": "buyer",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": [],
                "flags": ["show_in_available", "required", "shown_in_header", "seen_by_provider", "included_in_alerts"],
                "value": "507351",
                "category": "Untitled",
                "order": 3,
                "actions": []
            }, {
                "id": 15952,
                "name": "FP WO#",
                "tip": "Provider will be asked for this number by the ICC (Insight Command Center) during check in\/out.",
                "type": "text",
                "role": "buyer",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": [],
                "flags": ["show_in_available", "required", "shown_in_header", "admin_edit_only", "internal_id", "seen_by_provider", "included_in_alerts", "visible_to_clients"],
                "value": "WO328953",
                "category": "Untitled",
                "order": 4,
                "actions": []
            }, {
                "id": 18904,
                "name": "Planned Duration",
                "tip": "In hours",
                "type": "numeric",
                "role": "buyer",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": [],
                "flags": ["seen_by_provider"],
                "value": "2",
                "category": "Untitled",
                "order": 7,
                "actions": []
            }]
        }, {
            "id": 2,
            "name": "General",
            "order": 12,
            "role": "buyer",
            "metadata": {"total": 3, "page": 1, "pages": 1, "per_page": 3},
            "results": [{
                "id": 22299,
                "name": "Site ID",
                "tip": "",
                "type": "text",
                "role": "buyer",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": [],
                "flags": ["shown_in_header", "seen_by_provider", "included_in_alerts"],
                "value": "2229-Banfield",
                "category": "General",
                "order": 12,
                "actions": []
            }, {
                "id": 31127,
                "name": "Site Name",
                "tip": "",
                "type": "text",
                "role": "buyer",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": [],
                "flags": ["shown_in_header", "seen_by_provider", "included_in_alerts"],
                "value": "Petsmart Banfield Morrisville",
                "category": "General",
                "order": 13,
                "actions": []
            }, {
                "id": 23527,
                "name": "Device Count",
                "tip": "",
                "type": "text",
                "role": "buyer",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": [],
                "flags": ["seen_by_provider"],
                "value": "",
                "category": "General",
                "order": 14,
                "actions": []
            }]
        }, {
            "id": 3,
            "name": "General",
            "order": 17,
            "role": "assigned_provider",
            "metadata": {"total": 1, "page": 1, "pages": 1, "per_page": 1},
            "results": [{
                "id": 32782,
                "name": "Site Outcome",
                "tip": "",
                "type": "predefined",
                "role": "assigned_provider",
                "dependency": {"id": 0, "value": "", "operator": "equals"},
                "used_in_finance": false,
                "options": ["Site Complete \/ Fully Operational", "Site Incomplete"],
                "flags": ["required", "seen_by_provider"],
                "value": "",
                "category": "General",
                "order": 17,
                "actions": ["edit"]
            }]
        }],
        "correlation_id": "b69638ec61c6c2b6f844ce465c5c8bed7074feb5"
    },
    "has_onsite_custom_field": false,
    "qualifications": {
        "actions": [],
        "correlation_id": "adf40f83fd8cc5228715dc9e624250ab79e6c058",
        "selection_rule": {
            "id": 202728,
            "name": "ICR Selection - Not Currently Assigned",
            "status": "match",
            "actions": [],
            "total_selection_rule": "21",
            "weight": 16,
            "sum": {"total": 16, "match": 2, "no_match_optional": 0, "no_match_required": 0},
            "results": [{
                "id": 61,
                "name": "SC_TYPE_OF_WORK",
                "service": "",
                "description": "You must have the type of work: Desktop\/Laptop",
                "custom_field": {"id": 0},
                "operation": "equal_to",
                "order": 0,
                "extra": "",
                "required": true,
                "status": "match",
                "value": "Desktop\/Laptop",
                "weight": 1
            }, {
                "id": 802774,
                "name": "SC_BACKGROUND_CHECK",
                "service": "SelectionCriteriaLogicBackgroundCheck",
                "custom_field": {"id": 0},
                "operation": "equal_to",
                "order": 0,
                "extra": "{\"use_company_rating\":0,\"blue_ribbon_check\":0,\"first_advantage_check\":0,\"checkr_check\":1}",
                "required": true,
                "weight": 15,
                "value": "12",
                "status": "match",
                "description": "You must have passed a background check"
            }],
            "metadata": {"per_page": 2, "pages": 0, "page": 1, "total": 2}
        },
        "ignored_missing_qualifications": false
    },
    "ratings": {
        "correlation_id": "7e63ed61191638ebad1fcbc81788dfc914bfb79a",
        "buyer": {
            "actions": [],
            "overall": {
                "approval_period": 7,
                "jobs": 17633,
                "percent_clear_expectations": 99,
                "percent_respectful": 99,
                "approval_days_suffix": "",
                "stars": 5,
                "ratings": 54289,
                "approval_days": 3,
                "approval_days_percentile": 90,
                "approval_days_range": 90,
                "days_90_percent_approval": "1",
                "percent_approval": [{"days": 3, "percent": 94}]
            },
            "work_order": {"remaining_approval_period": false},
            "blocks": {"blocked": false, "actions": ["add"]},
            "company": {"id": 60191},
            "manager": {"id": 312998}
        },
        "assigned_provider": {
            "actions": [],
            "overall": {
                "marketplace": {
                    "ratings": 8,
                    "stars": 4,
                    "categories": [{"type": "on_time", "percent": 0}, {
                        "type": "follow_instructions",
                        "percent": 0
                    }, {"type": "assignment_fulfilled", "percent": 76}, {"type": "right_deliverables", "percent": 0}]
                }
            },
            "user": {"id": 983643}
        }
    },
    "bundle": {"id": 0, "company_id": 60191, "metadata": {"total": 0, "per_page": 0}, "results": [], "actions": []},
    "auto_dispatch_stats": {"auto_assigned": false},
    "schedule": {
        "work_order_id": 16219367,
        "service_window": {
            "mode": "exact",
            "start": {"local": {"date": "2024-12-10", "time": "07:00:00"}, "utc": "2024-12-10 12:00:00"},
            "end": {"local": {"date": "", "time": ""}, "utc": ""}
        },
        "time_zone": {"id": 5, "name": "America\/New_York", "offset": 1, "short": "EST"},
        "status_id": 3,
        "company_id": 60191,
        "today_tomorrow": "Tomorrow",
        "est_labor_hours": 2,
        "updated": {
            "utc": "2024-11-14 21:35:24",
            "local": {"date": "2024-11-14", "time": "16:35:24"},
            "by": {"id": 738633, "name": "Integration User"}
        },
        "requests": {"metadata": {"total": 0, "per_page": 0, "page": 1, "pages": 1}, "results": [], "actions": ["add"]},
        "correlation_id": "a39c5dd412437e421888f2b5db33b4e996a38567",
        "actions": []
    },
    "conflicts": [],
    "eta": {
        "user": {"id": 983643},
        "task": {"id": 127729600},
        "start": {"local": {"date": "2024-12-10", "time": "07:00:00"}, "utc": "2024-12-10 12:00:00"},
        "end": {"local": {"date": "2024-12-10", "time": "13:00:00"}, "utc": "2024-12-10 18:00:00.000000"},
        "hour_estimate": 6,
        "notes": "",
        "status": {"name": "set", "updated": {"utc": "", "local": {"date": "", "time": ""}}},
        "condition": {
            "created": {"utc": "", "local": {"date": "", "time": ""}},
            "route": [],
            "drive_time": 0,
            "distance": 0,
            "status": "on_schedule",
            "estimated_delay": 0,
            "coords": {"latitude": 35.881046, "longitude": -78.742859}
        },
        "mode": "between",
        "updated": {
            "utc": "2024-11-20 16:00:47",
            "local": {"date": "2024-11-20", "time": "11:00:47"},
            "by": {"id": "983643", "name": "Ihor Tiazhkorob"}
        },
        "window_duration": 0,
        "actions": ["edit", "running_late", "cancel", "cant_confirm"]
    },
    "location": {
        "coordinates": {"latitude": 35.8045, "longitude": -78.818, "exact": true},
        "work_order_id": 16219367,
        "mode": "custom",
        "address1": "3101 Market Center Dr",
        "address2": "",
        "city": "Morrisville",
        "state": "NC",
        "zip": "27560",
        "country": "US",
        "notes": [],
        "type": {"id": 1, "name": "Commercial"},
        "saved_location": {"id": 0, "name": "", "display_name": ""},
        "display_name": "",
        "status_id": 3,
        "correlation_id": "bff85e56cda8939cc5bdc0eae2765ad3eacc98de",
        "zoom": "13z",
        "map": {
            "url": "https:\/\/api.maptiler.com\/maps\/streets\/static\/-78.818000,35.804500,13\/320x300@2x.png?key=RZydBF85bkJ7CsJrAl6B&attribution=0&markers=-78.818,35.8045|,",
            "href": "https:\/\/www.google.com\/maps\/search\/3101+Market+Center+Dr+Morrisville+NC+27560\/@35.8045,-78.818,13z"
        },
        "actions": ["map"]
    },
    "coords": {
        "distance": 6.76662853049109,
        "latitude": 35.8888,
        "longitude": -78.7351,
        "exact": false,
        "user_id": 983643
    },
    "holds": {
        "metadata": {"total": 0, "per_page": 0, "pages": 1, "page": 1},
        "actions": [],
        "results": [],
        "categories": [{"id": 4, "name": "Pending Funds"}, {"id": 22, "name": "Pending Parts"}, {
            "id": 23,
            "name": "Pending Scope Approval"
        }, {"id": 24, "name": "Pending Reschedule"}],
        "correlation_id": "8a10177a440cbb8260efbd6464674e230091d82c"
    },
    "company": {
        "id": 60191,
        "name": "Insight Enterprises Inc.",
        "photo": "https:\/\/s3.amazonaws.com\/fieldnation\/company_logo\/60191.png?id=60191",
        "display_company_offer_setting": true,
        "check_in_instructions": "",
        "check_out_instructions": "",
        "provider_utilization_max_hours": 0,
        "provider_utilization_max_weekly": 0,
        "address": {
            "address1": "2701 E Insight Way",
            "address2": "",
            "city": "Chandler",
            "state": "AZ",
            "postalCode": "85286",
            "country": "US"
        },
        "features": [{"id": 11, "name": "Auto Dispatch"}, {"id": 12, "name": "Training Module"}, {
            "id": 26,
            "name": "Lipo"
        }, {"id": 43, "name": "Productivity Dashboard"}, {"id": 4, "name": "Buy from marketplace"}, {
            "id": 52,
            "name": "Multi Tiered Auto Dispatch"
        }, {"id": 5, "name": "Show All Tech Phone Numbers"}, {
            "id": 6,
            "name": "Show Worked With Tech Emails"
        }, {"id": 7, "name": "Penalty Charges"}]
    },
    "manager": {
        "thumbnail": "https:\/\/s3.amazonaws.com\/fieldnation\/profile_image\/312998-59f236e05958e.png",
        "id": 312998,
        "username": "insight.dispatcher",
        "first_name": "Insight",
        "last_name": "Dispatcher",
        "name": "Insight Dispatcher",
        "email": "askicr@insight.com",
        "phone": "+18003592620"
    },
    "w2": false,
    "import_id": 0,
    "printable": true,
    "status": {
        "id": 3,
        "name": "Assigned",
        "display": "Start Time Set",
        "is_routed": false,
        "code": "on_schedule",
        "sub_status": "",
        "delay": 0,
        "ncns": true,
        "confirmed": true,
        "correlation_id": "0a11dd685dddb9b3a385218ecf7c780a354ed379"
    },
    "messages": {
        "metadata": {"total": 13, "per_page": 0, "pages": 1, "page": 1},
        "actions": ["add"],
        "results": [],
        "correlation_id": "60da046e2591c4b74bdef94a7cd123cd155123f2"
    },
    "require_registered_service_companies": false,
    "assignee": {
        "user": {
            "id": 983643,
            "email": "vinsonfn24@gmail.com",
            "first_name": "Ihor",
            "last_name": "Tiazhkorob",
            "address1": "8044 Sycamore Hill Ln",
            "address2": "",
            "city": "Raleigh",
            "state": "NC",
            "zip": "27612",
            "country": "US",
            "coords": {"latitude": 35.881, "longitude": -78.7429},
            "cell": "+15096099820",
            "phone": "",
            "phone_ext": "",
            "thumbnail": "https:\/\/s3.amazonaws.com\/fieldnation\/profile_image\/983643-66ecafef1083f.png",
            "contract_company_id": 938092
        }, "status_id": 3, "work_order_id": 16219367, "in_confirmation_window": false, "actions": ["unassign"]
    },
    "milestones": {
        "time_to_dispatch": 355431,
        "time_to_work_done": 1968628,
        "time_alive": 1613197,
        "time_to_approve": 0,
        "created": {"utc": "2024-11-14 21:35:26", "local": {"date": "2024-11-14", "time": "16:35:26"}},
        "published": {"utc": "2024-11-19 00:19:17", "local": {"date": "2024-11-18", "time": "19:19:17"}},
        "routed": {"utc": "", "local": {"date": "", "time": ""}},
        "assigned": {"utc": "2024-11-20 16:00:35", "local": {"date": "2024-11-20", "time": "11:00:35"}},
        "workdone": {"utc": "", "local": {"date": "", "time": ""}},
        "approved": {"utc": "", "local": {"date": "", "time": ""}},
        "paid": {"utc": "", "local": {"date": "", "time": ""}},
        "canceled": {"utc": "", "local": {"date": "", "time": ""}}
    },
    "contacts": {
        "metadata": {"total": 1, "per_page": 1, "pages": 1, "page": 1},
        "results": [{
            "id": -2,
            "role": "Work Order Manager",
            "name": "Insight Dispatcher",
            "email": "askicr@insight.com",
            "phone": "+18003592620",
            "ext": "",
            "notes": "",
            "actions": []
        }],
        "correlation_id": "df5138a88be7f549066fc9117a445535c846d0f6",
        "actions": []
    },
    "tasks": {
        "metadata": {
            "total": 12,
            "per_page": 12,
            "pages": 1,
            "page": 1,
            "completed": {
                "confirmassignment": 1,
                "other": 0,
                "checkin": 0,
                "phone": 0,
                "signature": 0,
                "checkout": 0,
                "closeoutnotes": 0
            }
        }, "results": [{
            "id": 127729600,
            "description": "Set start time",
            "descriptions": {"task": "Set start time", "first": "", "second": "", "third": "", "fourth": ""},
            "label": "Set Start Time",
            "alerts": [],
            "group": {"label": "Pre visit", "id": "prep"},
            "type": {"id": 1, "key": "confirmassignment", "name": "Set Start Time"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 983643, "first_name": "Ihor", "last_name": "Tiazhkorob"},
            "status": "complete",
            "completed": {
                "utc": "2024-11-20 16:00:46",
                "local": {"date": "2024-11-20", "time": "11:00:46"},
                "by": {"id": 983643, "name": "Ihor Tiazhkorob", "assigned": true}
            },
            "eta": {
                "user": {"id": 983643},
                "task": {"id": 127729600},
                "start": {"local": {"date": "2024-12-10", "time": "07:00:00"}, "utc": "2024-12-10 12:00:00"},
                "end": {"local": {"date": "2024-12-10", "time": "13:00:00"}, "utc": "2024-12-10 18:00:00.000000"},
                "hour_estimate": 6,
                "notes": "",
                "status": {"name": "set", "updated": {"utc": "", "local": {"date": "", "time": ""}}},
                "condition": {
                    "created": {"utc": "", "local": {"date": "", "time": ""}},
                    "route": [],
                    "drive_time": 0,
                    "distance": 0,
                    "status": "on_schedule",
                    "estimated_delay": 0,
                    "coords": {"latitude": 35.881046, "longitude": -78.742859}
                },
                "mode": "between",
                "updated": {
                    "utc": "2024-11-20 16:00:47",
                    "local": {"date": "2024-11-20", "time": "11:00:47"},
                    "by": {"id": "983643", "name": "Ihor Tiazhkorob"}
                },
                "window_duration": 0,
                "actions": ["edit", "running_late", "cancel", "cant_confirm"]
            },
            "actions": ["incomplete"]
        }, {
            "id": 127729601,
            "description": "Print your site-specific access letter. It will be emailed to you prior to arrival on site. Must present to site contact upon arrival.",
            "descriptions": {
                "task": "Print your site-specific access letter. It will be emailed to you prior to arrival on site. Must present to site contact upon arrival.",
                "first": "",
                "second": "",
                "third": "",
                "fourth": ""
            },
            "label": "Print your site-specific access letter. It will be emailed to you prior to arrival on site. Must present to site contact upon arrival.",
            "alerts": [],
            "group": {"label": "Pre visit", "id": "prep"},
            "type": {"id": 10, "key": "other", "name": "Unique task"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"]
        }, {
            "id": 127729602,
            "description": "Print list of employee names who will get an access token. This will be emailed to you prior to your arrival on site. Call 800-359-2620 if you need assistance.",
            "descriptions": {
                "task": "Print list of employee names who will get an access token. This will be emailed to you prior to your arrival on site. Call 800-359-2620 if you need assistance.",
                "first": "",
                "second": "",
                "third": "",
                "fourth": ""
            },
            "label": "Print list of employee names who will get an access token. This will be emailed to you prior to your arrival on site. Call 800-359-2620 if you need assistance.",
            "alerts": [],
            "group": {"label": "Pre visit", "id": "prep"},
            "type": {"id": 10, "key": "other", "name": "Unique task"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"]
        }, {
            "id": 127729591,
            "description": "Check in",
            "descriptions": {"task": "Check in", "first": "", "second": "", "third": "", "fourth": ""},
            "label": "Check in",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 3, "key": "checkin", "name": "Check in"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "time_log": [],
            "actions": []
        }, {
            "id": 127729593,
            "description": "Call +1 800-359-2620 regarding Check in with the Insight Command Center (ICC).",
            "descriptions": {
                "task": "Call",
                "first": "+1 800-359-2620",
                "second": "regarding",
                "third": "Check in with the Insight Command Center (ICC).",
                "fourth": ""
            },
            "label": "Check in with the Insight Command Center (ICC).",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 8, "key": "phone", "name": "Call phone number"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"],
            "phone": "+1 800-359-2620"
        }, {
            "id": 127729594,
            "description": "Notate your employee list with progress for each user. This must be uploaded to the FieldPower checklist.",
            "descriptions": {
                "task": "Notate your employee list with progress for each user. This must be uploaded to the FieldPower checklist.",
                "first": "",
                "second": "",
                "third": "",
                "fourth": ""
            },
            "label": "Notate your employee list with progress for each user. This must be uploaded to the FieldPower checklist.",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 10, "key": "other", "name": "Unique task"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"]
        }, {
            "id": 127729595,
            "description": "Ensure any trash is disposed of properly before leaving site. Leave all work spaces neat and tidy.",
            "descriptions": {
                "task": "Ensure any trash is disposed of properly before leaving site. Leave all work spaces neat and tidy.",
                "first": "",
                "second": "",
                "third": "",
                "fourth": ""
            },
            "label": "Ensure any trash is disposed of properly before leaving site. Leave all work spaces neat and tidy.",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 10, "key": "other", "name": "Unique task"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"]
        }, {
            "id": 127729596,
            "description": "Complete FieldPower checklist while on site. Call 800-359-2620 for FieldPower assistance.",
            "descriptions": {
                "task": "Complete FieldPower checklist while on site. Call 800-359-2620 for FieldPower assistance.",
                "first": "",
                "second": "",
                "third": "",
                "fourth": ""
            },
            "label": "Complete FieldPower checklist while on site. Call 800-359-2620 for FieldPower assistance.",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 10, "key": "other", "name": "Unique task"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"]
        }, {
            "id": 127729597,
            "description": "Collect signature from on-site manager.",
            "descriptions": {
                "task": "Collect signature",
                "first": "from",
                "second": "on-site manager.",
                "third": "",
                "fourth": ""
            },
            "label": "on-site manager.",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 11, "key": "signature", "name": "Collect a signature"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"]
        }, {
            "id": 127729598,
            "description": "Call +1 800-359-2620 regarding Check out and deliverable review with the ICC.",
            "descriptions": {
                "task": "Call",
                "first": "+1 800-359-2620",
                "second": "regarding",
                "third": "Check out and deliverable review with the ICC.",
                "fourth": ""
            },
            "label": "Check out and deliverable review with the ICC.",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 8, "key": "phone", "name": "Call phone number"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"],
            "phone": "+1 800-359-2620"
        }, {
            "id": 127729599,
            "description": "Check out",
            "descriptions": {"task": "Check out", "first": "", "second": "", "third": "", "fourth": ""},
            "label": "Check out",
            "alerts": [],
            "group": {"label": "On site", "id": "onsite"},
            "type": {"id": 4, "key": "checkout", "name": "Check out"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": [],
            "time_log": []
        }, {
            "id": 127729603,
            "description": "Enter closeout notes",
            "descriptions": {"task": "Enter closeout notes", "first": "", "second": "", "third": "", "fourth": ""},
            "label": "Enter close out notes",
            "alerts": [],
            "group": {"label": "Post site", "id": "post"},
            "type": {"id": 2, "key": "closeoutnotes", "name": "Enter close out notes"},
            "created": {"utc": "2024-11-14 21:35:24", "local": {"date": "2024-11-14", "time": "16:35:24"}},
            "author": {"id": 0, "first_name": "", "last_name": ""},
            "status": "incomplete",
            "actions": ["complete"],
            "closing_notes": "",
            "closing_notes_internal": []
        }], "correlation_id": "310c065ca93ba180a7360d15dd504d1b3e524fc9", "actions": []
    },
    "swaps": {
        "metadata": {"total": 0, "per_page": 0, "pages": 1, "page": 1},
        "actions": [],
        "results": [],
        "correlation_id": "95102962c323cfa550892497ee28bce41c7271df"
    },
    "equipments": [],
    "service_types": [{"id": 558, "name": "Installation"}, {"id": 569, "name": "Setup"}],
    "service_types_legacy": [{"id": 53, "name": "Installation"}, {"id": 60, "name": "Setup"}],
    "site_device": [],
    "high_potential": false,
    "special_skill": {
        "id": 0,
        "required": false,
        "certification_id": 0,
        "dynamic_term_id": 0,
        "name": "",
        "feeReduction": 0,
        "fee": 0,
        "international": 0
    },
    "description": {
        "html": "<p>Insight is contracted to provide assistance with the installation process and desktop token access in preparation for the upcoming software rollout.&nbsp;<strong>The FieldPower mobile app is required for this project. Call the ICC at<\/strong><span style=\"color: rgb(255, 255, 255);\">800-359-2620<\/span>&nbsp;for app assistance.<\/p><p><strong><u>It is extremely important that you arrive ON TIME to get the manager and critical users set up BEFORE&nbsp;they start checking in patients Please make sure you allow enough travel time to arrive onsite ON TIME as indicated on your ticket.<\/u><\/strong><\/p><p><strong><u>*** A 10% PENALTY WILL BE APPLIED TO YOUR WORK ORDER IF YOU ARE MORE THAN 15 MINUTES LATE***<\/u><\/strong><\/p><p><strong>Qualified individuals will have:&nbsp;<\/strong><\/p><ul><li>Good soft skills and client facing attitude.<\/li><li>Ability to clearly communicate and train end users on hardware and software. Must be able to answer questions from users.<\/li><li>End user training experience preferred.<\/li><li>Basic technical experience with Windows in an enterprise environment required.<\/li><li><strong><u>MUST be on time.<\/u><\/strong><\/li><\/ul><p><strong>Scope:<\/strong><\/p><ul><li>Train and assist users with first time token setup and provide basic training on day-to-day use.<\/li><li>Mount USB extension cable with sensor to monitors using provided adhesive mounts, route and dress cables.<\/li><li>Conduct a brief survey that involves documenting any current or on-going IT issues with the manager and conducting Wi-Fi speed tests in each room.<\/li><li>Provide manager with basic training on user management if needed.<\/li><\/ul><p>Check in and out with the Insight Command center at<span style=\"color: rgb(255, 255, 255);\">1-800-359-2620<\/span>&nbsp;required.<\/p><p><strong>Tools needed:<\/strong><\/p><ul><li>Hard copy of site-specific access letter to present to manager on site. Will be emailed prior to your arrival. Call<span style=\"color: rgb(255, 255, 255);\">800-359-2620<\/span>&nbsp;for assistance<\/li><li>Fully charged smart phone&nbsp;<strong>and charger<\/strong><\/li><li class=\"ql-indent-1\">Must have the ability to take pictures and send emails<\/li><li class=\"ql-indent-1\">Must have FieldPower mobile app installed. Call&nbsp;<span style=\"color: rgb(255, 255, 255);\">800-359-2620<\/span>&nbsp;for log in\/app assistance.<\/li><li>Basic Desktop Tool Kit<\/li><li class=\"ql-indent-1\">Phillips and slotted screwdriver set<\/li><li class=\"ql-indent-1\">Torx driver set, Secure Torx recommended<\/li><li class=\"ql-indent-1\">Needle nose pliers<\/li><li class=\"ql-indent-1\">Wire cutters<\/li><li>Cable Ties or Velcro<\/li><\/ul><p><strong>Escalation:<\/strong>&nbsp;Please refer to your site procedure document (attached)<\/p><p><strong>Deliverables:<\/strong>&nbsp;FieldPower checklist<\/p><p><strong>Dress code:<\/strong>&nbsp;Business casual - Jeans are approved however must be clean, and not ripped. Collared shirts, no t-shirts.<\/p><p><strong><u>READ STANDARD INSTRUCTIONS PRIOR TO REQUESTING.<\/u><\/strong><\/p><p><strong>Terms for Travel:<\/strong>&nbsp;<\/p><ul><li>Payment amount listed on this WO is an all-in rate<\/li><li>If provider is seeking additional compensation for travel time due to distance from work order, this must be requested as a counter-offer PRIOR to assignment<\/li><li>If submitted post-assignment, pay increase requests for travel time will not be approved<\/li><li>Tolls or Parking fees will only be eligible for reimbursement if receipt is attached to the work order when closed out<\/li><\/ul><p><em>The job is considered incomplete if you leave site before sending any required deliverables and calling Insight Command Center at<\/em>&nbsp;<span style=\"color: rgb(255, 255, 255);\">800-359-2620<\/span>&nbsp;to check out, which will cause a delay in pay or no compensation.&nbsp;<\/p>",
        "markdown": "Insight is contracted to provide assistance with the installation process and desktop token access in preparation for the upcoming software rollout. **The FieldPower mobile app is required for this project. Call the ICC at**800-359-2620 for app assistance.\n\n**It is extremely important that you arrive ON TIME to get the manager and critical users set up BEFORE they start checking in patients Please make sure you allow enough travel time to arrive onsite ON TIME as indicated on your ticket.**\n\n**\\*\\*\\* A 10% PENALTY WILL BE APPLIED TO YOUR WORK ORDER IF YOU ARE MORE THAN 15 MINUTES LATE\\*\\*\\***\n\n**Qualified individuals will have:**\n\n- Good soft skills and client facing attitude.\n- Ability to clearly communicate and train end users on hardware and software. Must be able to answer questions from users.\n- End user training experience preferred.\n- Basic technical experience with Windows in an enterprise environment required.\n- **MUST be on time.**\n\n**Scope:**\n\n- Train and assist users with first time token setup and provide basic training on day-to-day use.\n- Mount USB extension cable with sensor to monitors using provided adhesive mounts, route and dress cables.\n- Conduct a brief survey that involves documenting any current or on-going IT issues with the manager and conducting Wi-Fi speed tests in each room.\n- Provide manager with basic training on user management if needed.\n\nCheck in and out with the Insight Command center at1-800-359-2620 required.\n\n**Tools needed:**\n\n- Hard copy of site-specific access letter to present to manager on site. Will be emailed prior to your arrival. Call800-359-2620 for assistance\n- Fully charged smart phone **and charger**\n- Must have the ability to take pictures and send emails\n- Must have FieldPower mobile app installed. Call 800-359-2620 for log in\/app assistance.\n- Basic Desktop Tool Kit\n- Phillips and slotted screwdriver set\n- Torx driver set, Secure Torx recommended\n- Needle nose pliers\n- Wire cutters\n- Cable Ties or Velcro\n\n**Escalation:** Please refer to your site procedure document (attached)\n\n**Deliverables:** FieldPower checklist\n\n**Dress code:** Business casual - Jeans are approved however must be clean, and not ripped. Collared shirts, no t-shirts.\n\n**READ STANDARD INSTRUCTIONS PRIOR TO REQUESTING.**\n\n**Terms for Travel:**\n\n- Payment amount listed on this WO is an all-in rate\n- If provider is seeking additional compensation for travel time due to distance from work order, this must be requested as a counter-offer PRIOR to assignment\n- If submitted post-assignment, pay increase requests for travel time will not be approved\n- Tolls or Parking fees will only be eligible for reimbursement if receipt is attached to the work order when closed out\n\n*The job is considered incomplete if you leave site before sending any required deliverables and calling Insight Command Center at* 800-359-2620 to check out, which will cause a delay in pay or no compensation.",
        "actions": []
    },
    "confidential": {"html": ""},
    "policy_and_procedures": {
        "html": "<span class=\"c2\"><span class=\"c1 c3\">Policy &amp; Procedure for all Technicians doing work for the Buyer on this Work Order<\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\"><br \/>Independent Contractor Status. Contractor on this work order expressly acknowledges and agrees that they (the Contractor on this work order) is acting as an Independent Contractor and not as an employee of the Buyer on this work order for all purposes. &nbsp;The Buyer on this work order shall not be liable for any obligation incurred by Contractor on this work order, including reimbursement of expenses incurred or paid by the Contractor on this work order in the performance of services contemplated by this Work Order, or for any acts of Contractor in Contractor&rsquo;s performance of the services described herein. &nbsp;Contractor on this Work Order has no authority to assume or create any obligations on behalf of the Buyer on this work order.<br \/><\/span><\/span><br \/><span id=\"h.gjdgxs\" class=\"c2\"><span class=\"c0\">Contractor on this work order further acknowledges and agrees that the Contractor is solely responsible for payment of all applicable state and federal self-employment withholding taxes, including FICA, Medicare, FUTA and other related taxes or charges, and that the Buyer on this Work Order shall neither withhold nor pay such or similar taxes on behalf of the Contractor on this Work Order. &nbsp;The Buyer on this Work Order shall not cover Contractor on this Work Order under any worker&rsquo;s compensation policy the Buyer on this Work Order may obtain. To the fullest extent permitted by law, the Contractor on this work order shall indemnify the Buyer on this work order form all damages, losses, or expenses, including attorney&rsquo;s fees, from any claims or damages for bodily injury, sickness, disease, or death, or form claims for damages to tangible property, other than the Work itself. &nbsp;This indemnification shall extend to claims resulting from performance of this Work Order and shall apply only to the extent that the claim or loss is caused in whole or in part by any negligent act or omission of Contractor on this Work Order or any of its agents, employees, or subcontractors. &nbsp;This indemnity shall be effective regardless of whether the claim or loss is caused in some part by a party to be indemnified. The Contractor on this Work Order agrees to hold the Buyer on this Work Order harmless in the event of damages or injuries due to any negligence of the Contractor on this Work Order&rsquo;s part, and that the Contractor on this Work Order will pay all legal and defense costs associated with any damage or injury claims.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">*****ATTENTION: ALL ITEMS ARE REQUIRED FOR PAYMENT****<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Failure to comply with the any of our policies and procedures listed below may result in a reduction or loss of compensation on this work order.<br \/><br \/>-<span>Insight <strong>strictly prohibits<\/strong> carrying or possessing any weapons, including firearms, inside the workplace or while completing any work on behalf of Insight.<\/span><br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-The requesting provider must be the provider who performs the actual service work onsite. &nbsp;You are expected to arrive onsite by yourself (no helpers, or assistants). &nbsp;Exceptions may be given but only upon prior approval by the Buyer on this Work Order. &nbsp;<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Dress Code: Business casual is required. &nbsp;No denim; t-shirts; logos or tennis shoes are allowed (work boots are acceptable).<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Present yourself as an authorized representative of the Buyer on this Work Order, performing service on behalf of the Buyer on this Work Order. &nbsp;Do not promote any other company other than the Buyer on this Work Order, while on our jobsites.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Print this work order and all additional documentation. &nbsp;You MUST read the complete work order prior to arrival. &nbsp;Direct all questions to the Buyer on this Work Order.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-You are expected to arrive on time and be prepared to perform the specified work on the given date and time provided on this work order. &nbsp;You must contact the Buyer of this work order immediately, if for any reason you are unable to make the specified service schedule detailed on this work order (this is the time that you agreed to arrive when requesting or accepting this work order). &nbsp;The Buyer may elect to replace you as the assigned provider on this work order with no compensation (including cancellation fees), if you are unable to make the scheduled start time, or you are late for the scheduled start time.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Work performed outside the original Service Information detailed on this work order will not be compensated to the provider by the Buyer on this Work Order unless it has been pre-approved by the Buyer&rsquo;s Work Order manager. &nbsp;Requests by the provider for any payment increase must be documented in the messages tab, of this work order, for any payment increase to be considered for approval.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-By requesting this work order you agree to warranty all work performed on this work order to the Buyer on this Work Order, for a minimum period of 15-business days. &nbsp;Warranty period will begin from the date that the Buyer on this Work Order has approved this work order electronically on the Field Nation platform. &nbsp;You will be required to repair all failed work, at no additional costs to the Buyer on this Work Order within 3-business days of being notified of the warranty issue.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-You agree to provide the Buyer on this Work Order with a 100% satisfaction guarantee. If you fail to fully complete the Services specified, then the Buyer on this Work Order will not consider the work order complete.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-By accepting this work order you are stating that you have the expertise, tools and equipment required to perform the services in accordance with industry standards and practices that are required on this work order.<br \/><br \/><span>-Any disparaging remarks about Insight, the client, technology process or rude, unprofessional behavior will result in the buyer being banned from any future jobs from Insight and will be rated accordingly.<\/span><br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Acceptance of work order enters you into a legally binding contract to perform the services. &nbsp;By accepting this work order you agree not to solicit any business directly with the Buyer&rsquo;s client that you are performing work for on this work order.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-The Spend Limit set on this work order is inclusive of all costs.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-If upon arrival you find that the work site is not ready for services you must contact the work order manager listed by the Buyer on this Work Order. &nbsp;This contact must be made prior to leaving the premises for further instructions. &nbsp;Failure to do so will be considered a &lsquo;No-Show&rsquo; on your part.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Deliverables are required within 12-hours of the completion of this work order.<br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-All photos uploaded as deliverables must be completely in focus and taken with proper lighting. &nbsp;Any photo(s) deemed &lsquo;blurry&rsquo; or &lsquo;dark&rsquo; by the Buyer on this Work Order-will be rejected and the work order will not be considered for approval until acceptable photo(s) have been re-taken and uploaded to the work order by the assigned provider.<br \/><br \/><strong>Do not post on social media about Insight work, clients, locations, or scope without written consent from Insight and the respective clients.<\/strong><br \/><\/span><\/span><br \/><span class=\"c2\"><span class=\"c0\">-Do not cancel appointments. In case of emergency contact the Insight Command Center at 800-359-2620<\/span><\/span>",
        "markdown": "Policy & Procedure for all Technicians doing work for the Buyer on this Work Order  \n  \nIndependent Contractor Status. Contractor on this work order expressly acknowledges and agrees that they (the Contractor on this work order) is acting as an Independent Contractor and not as an employee of the Buyer on this work order for all purposes. The Buyer on this work order shall not be liable for any obligation incurred by Contractor on this work order, including reimbursement of expenses incurred or paid by the Contractor on this work order in the performance of services contemplated by this Work Order, or for any acts of Contractor in Contractor\u2019s performance of the services described herein. Contractor on this Work Order has no authority to assume or create any obligations on behalf of the Buyer on this work order.  \n  \nContractor on this work order further acknowledges and agrees that the Contractor is solely responsible for payment of all applicable state and federal self-employment withholding taxes, including FICA, Medicare, FUTA and other related taxes or charges, and that the Buyer on this Work Order shall neither withhold nor pay such or similar taxes on behalf of the Contractor on this Work Order. The Buyer on this Work Order shall not cover Contractor on this Work Order under any worker\u2019s compensation policy the Buyer on this Work Order may obtain. To the fullest extent permitted by law, the Contractor on this work order shall indemnify the Buyer on this work order form all damages, losses, or expenses, including attorney\u2019s fees, from any claims or damages for bodily injury, sickness, disease, or death, or form claims for damages to tangible property, other than the Work itself. This indemnification shall extend to claims resulting from performance of this Work Order and shall apply only to the extent that the claim or loss is caused in whole or in part by any negligent act or omission of Contractor on this Work Order or any of its agents, employees, or subcontractors. This indemnity shall be effective regardless of whether the claim or loss is caused in some part by a party to be indemnified. The Contractor on this Work Order agrees to hold the Buyer on this Work Order harmless in the event of damages or injuries due to any negligence of the Contractor on this Work Order\u2019s part, and that the Contractor on this Work Order will pay all legal and defense costs associated with any damage or injury claims.  \n  \n\\*\\*\\*\\*\\*ATTENTION: ALL ITEMS ARE REQUIRED FOR PAYMENT\\*\\*\\*\\*  \n  \n-Failure to comply with the any of our policies and procedures listed below may result in a reduction or loss of compensation on this work order.  \n  \n-Insight **strictly prohibits** carrying or possessing any weapons, including firearms, inside the workplace or while completing any work on behalf of Insight.  \n  \n-The requesting provider must be the provider who performs the actual service work onsite. You are expected to arrive onsite by yourself (no helpers, or assistants). Exceptions may be given but only upon prior approval by the Buyer on this Work Order.   \n  \n-Dress Code: Business casual is required. No denim; t-shirts; logos or tennis shoes are allowed (work boots are acceptable).  \n  \n-Present yourself as an authorized representative of the Buyer on this Work Order, performing service on behalf of the Buyer on this Work Order. Do not promote any other company other than the Buyer on this Work Order, while on our jobsites.  \n  \n-Print this work order and all additional documentation. You MUST read the complete work order prior to arrival. Direct all questions to the Buyer on this Work Order.  \n  \n-You are expected to arrive on time and be prepared to perform the specified work on the given date and time provided on this work order. You must contact the Buyer of this work order immediately, if for any reason you are unable to make the specified service schedule detailed on this work order (this is the time that you agreed to arrive when requesting or accepting this work order). The Buyer may elect to replace you as the assigned provider on this work order with no compensation (including cancellation fees), if you are unable to make the scheduled start time, or you are late for the scheduled start time.  \n  \n-Work performed outside the original Service Information detailed on this work order will not be compensated to the provider by the Buyer on this Work Order unless it has been pre-approved by the Buyer\u2019s Work Order manager. Requests by the provider for any payment increase must be documented in the messages tab, of this work order, for any payment increase to be considered for approval.  \n  \n-By requesting this work order you agree to warranty all work performed on this work order to the Buyer on this Work Order, for a minimum period of 15-business days. Warranty period will begin from the date that the Buyer on this Work Order has approved this work order electronically on the Field Nation platform. You will be required to repair all failed work, at no additional costs to the Buyer on this Work Order within 3-business days of being notified of the warranty issue.  \n  \n-You agree to provide the Buyer on this Work Order with a 100% satisfaction guarantee. If you fail to fully complete the Services specified, then the Buyer on this Work Order will not consider the work order complete.  \n  \n-By accepting this work order you are stating that you have the expertise, tools and equipment required to perform the services in accordance with industry standards and practices that are required on this work order.  \n  \n-Any disparaging remarks about Insight, the client, technology process or rude, unprofessional behavior will result in the buyer being banned from any future jobs from Insight and will be rated accordingly.  \n  \n-Acceptance of work order enters you into a legally binding contract to perform the services. By accepting this work order you agree not to solicit any business directly with the Buyer\u2019s client that you are performing work for on this work order.  \n  \n-The Spend Limit set on this work order is inclusive of all costs.  \n  \n-If upon arrival you find that the work site is not ready for services you must contact the work order manager listed by the Buyer on this Work Order. This contact must be made prior to leaving the premises for further instructions. Failure to do so will be considered a \u2018No-Show\u2019 on your part.  \n  \n-Deliverables are required within 12-hours of the completion of this work order.  \n  \n-All photos uploaded as deliverables must be completely in focus and taken with proper lighting. Any photo(s) deemed \u2018blurry\u2019 or \u2018dark\u2019 by the Buyer on this Work Order-will be rejected and the work order will not be considered for approval until acceptable photo(s) have been re-taken and uploaded to the work order by the assigned provider.  \n  \n**Do not post on social media about Insight work, clients, locations, or scope without written consent from Insight and the respective clients.**  \n  \n-Do not cancel appointments. In case of emergency contact the Insight Command Center at 800-359-2620"
    },
    "standard_instructions": {
        "html": "<span class=\"ui-provider a b c d e f g h i j k l m n o p q r s t u v w x y z ab ac ae af ag ah ai aj ak\" dir=\"ltr\">**Your client soft skills and customer satisfaction rating will determine your eligibility for additional work with Insight. Providing excellent service and demonstrating professionalism will increase your chances of being selected for future projects. However, poor service, rude or unprofessional behavior will result in disqualification from future work opportunities with Insight.**<\/span><br \/><br \/>TECH SWAPPING IS NOT ALLOWED WITHOUT PRIOR APPROVAL.&nbsp; FAILURE TO DO SO MAY RESULT IN NON PAYMENT.<br \/><br \/>Provider may be required to present photo ID while on site.<br \/><span class=\"scxw256751438\"><span><br \/>If provider is seeking additional compensation or pay change for scope of work, tolls, mileage, or travel time, this must be submitted as a counter-offer prior to provider being assigned to this work order and will not be approved post-assignment.<br \/><br \/>Tolls or parking fees will only be eligible for reimbursement if receipt is attached to the expense.<\/span><\/span>",
        "markdown": "\\*\\*Your client soft skills and customer satisfaction rating will determine your eligibility for additional work with Insight. Providing excellent service and demonstrating professionalism will increase your chances of being selected for future projects. However, poor service, rude or unprofessional behavior will result in disqualification from future work opportunities with Insight.\\*\\*  \n  \nTECH SWAPPING IS NOT ALLOWED WITHOUT PRIOR APPROVAL. FAILURE TO DO SO MAY RESULT IN NON PAYMENT.  \n  \nProvider may be required to present photo ID while on site.  \n  \nIf provider is seeking additional compensation or pay change for scope of work, tolls, mileage, or travel time, this must be submitted as a counter-offer prior to provider being assigned to this work order and will not be approved post-assignment.  \n  \nTolls or parking fees will only be eligible for reimbursement if receipt is attached to the expense."
    },
    "progress": {"sum": {"all": 12, "complete": 1, "incomplete": 11}, "label": "Tasks"},
    "require_ein": false,
    "advanced_qualifications": true,
    "pending_routing_provider": [],
    "attributes": {"survey_id": 0, "ignored_missing_qualifications": false, "workorder_network_change_admin_only": "0"},
    "require_gps": true,
    "require_ontime": true,
    "has_version_change": true,
    "smart_matched": false,
    "role": {
        "role": "assigned_provider",
        "role_context": 0,
        "network_id": 0,
        "status_id": 3,
        "is_remote": false,
        "assigned_user_id": 983643,
        "manager_id": 312998,
        "service_company_id": 0,
        "sub_roles": ["ncns", "can_request", "has_marketplace", "provider"],
        "active_managed_provider": 0,
        "work_order_company_id": 60191,
        "managed_work_order": false
    },
    "workflow_completion": {
        "metadata": {"page": 1, "pages": 1, "per_page": 13, "total": 13},
        "status": "invalid",
        "results": ["Custom field \"Site Outcome\" must be entered.", "Task incomplete: Print your site-specific access letter. It will be emailed to you prior to arrival on site. Must present to site contact upon arrival.", "Task incomplete: Print list of employee names who will get an access token. This will be emailed to you prior to your arrival on site. Call 800-359-2620 if you need assistance.", "Task incomplete: Check in", "Task incomplete: Call +1 800-359-2620 regarding Check in with the Insight Command Center (ICC).", "Task incomplete: Notate your employee list with progress for each user. This must be uploaded to the FieldPower checklist.", "Task incomplete: Ensure any trash is disposed of properly before leaving site. Leave all work spaces neat and tidy.", "Task incomplete: Complete FieldPower checklist while on site. Call 800-359-2620 for FieldPower assistance.", "Task incomplete: Collect signature from on-site manager.", "Task incomplete: Call +1 800-359-2620 regarding Check out and deliverable review with the ICC.", "Task incomplete: Check out", "Task incomplete: Enter closeout notes", "Time must be logged."]
    },
    "types_of_work": [{
        "id": 177,
        "name": "Windows Device",
        "isPrimary": true,
        "legacyTypeOfWorkId": null,
        "source": "self_reported"
    }],
    "segments": [{
        "id": 177,
        "name": "Windows Device",
        "isPrimary": true,
        "legacyTypeOfWorkId": null,
        "source": "self_reported"
    }],
    "tags": {
        "metadata": {"total": 1, "per_page": 1, "pages": 1, "page": 1},
        "actions": [],
        "results": [{
            "created": {"utc": "2024-11-20 16:00:35", "local": {"date": "2024-11-20", "time": "11:00:35"}},
            "author": {"id": 896394},
            "id": 16,
            "label": "Unconfirmed",
            "hex_color": "#C0C0C0",
            "types": ["substatus"],
            "actions": []
        }],
        "correlation_id": "fb8627af6cb825be74c1704e57a7effe2d2d9fa2"
    },
    "work_order_id": 16219367,
    "actions": ["messaging", "tasks", "print", "buyer_name_shown", "closing_notes", "schedule_request", "require_gps", "completable"],
    "title": "Desktop Access Token HW\/SW Setup| White-Glove End User Training | Animal Hospital",
    "correlation_id": "e1f5770973854a5a121a8a999e7486f931fca7f0",
    "href": "https:\/\/app.fieldnation.com\/workorders\/16219367",
    "type_of_work": {"id": 61, "name": "Desktop\/Laptop"},
    "closing_notes": "",
    "tasks_enabled": true,
    "workflow_cancel": {
        "metadata": {"total": 1, "pages": 1, "per_page": 1, "page": 1},
        "results": ["Your role is not allowed to cancel this work order."],
        "status": "invalid"
    },
    "stalled": {"actions": [], "status": "invalid", "action_date": {"utc": "", "local": {"date": "", "time": ""}}}
};