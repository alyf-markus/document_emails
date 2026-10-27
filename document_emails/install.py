import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from document_emails import DOCTYPES

FIELDNAMES = ("email_tab", "email_html")


def create_email_tab():
	create_custom_fields({doctype: get_fields(doctype) for doctype in DOCTYPES}, update=True)


def get_fields(doctype: str) -> list[dict]:
	# Without insert_after the tab would become the first tab and take over the main fields.
	last_fieldname = [field.fieldname for field in frappe.get_meta(doctype).fields if field.fieldname not in FIELDNAMES][-1]
	return [
		{"fieldname": "email_tab", "fieldtype": "Tab Break", "label": "Emails", "insert_after": last_fieldname},
		{"fieldname": "email_html", "fieldtype": "HTML", "insert_after": "email_tab"},
	]
