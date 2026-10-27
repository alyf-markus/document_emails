import frappe
from frappe.core.utils import html2text
from frappe.desk.form.load import get_communication_data
from frappe.desk.notifications import get_dynamic_link_filters, get_internal_links

from document_emails import DOCTYPES

MAX_DOCUMENTS = 100
MAX_EMAILS_PER_DOCUMENT = 500
PREVIEW_LENGTH = 200
EMAIL_FIELDS = """
	C.name, C.communication_date, C.subject, C.content,
	C.sender, C.sender_full_name, C.recipients, C.cc,
	C.sent_or_received, C.delivery_status
"""


@frappe.whitelist()
def get_emails(doctype: str, name: str) -> list[dict]:
	"""Return the emails of this document and all connected predecessors and successors."""
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")

	emails = {}
	for linked_doctype, linked_name in get_connected_documents(doc):
		communications = get_communication_data(
			linked_doctype, linked_name, limit=MAX_EMAILS_PER_DOCUMENT, fields=EMAIL_FIELDS
		)
		for email in communications:
			if email.name in emails:
				continue  # linked to more than one document of the chain

			email.document_doctype = linked_doctype
			email.document_name = linked_name
			email.preview = get_preview(email.content)
			emails[email.name] = email

	return sorted(emails.values(), key=lambda email: email.communication_date, reverse=True)


def get_connected_documents(doc) -> list[tuple[str, str]]:
	"""Return the document plus every readable document reachable via its connections.

	Documents the user cannot read are skipped and not followed any further.
	"""
	found = [(doc.doctype, doc.name)]
	queue = [doc]
	while queue and len(found) < MAX_DOCUMENTS:
		current = queue.pop(0)
		for linked_doctype, linked_name in get_linked_documents(current):
			if (linked_doctype, linked_name) in found:
				continue

			# checks the role permissions for the DocType and the user permissions for the document
			if not frappe.has_permission(linked_doctype, "read", linked_name):
				continue

			found.append((linked_doctype, linked_name))
			queue.append(frappe.get_doc(linked_doctype, linked_name))

	return found


def get_linked_documents(doc) -> list[tuple[str, str]]:
	"""Return predecessors and successors as shown in the Connections of the document.

	Mirrors frappe.desk.notifications._get_linked_document_counts, but returns names instead of counts.
	"""
	links = doc.meta.get_dashboard_data()
	internal_links = links.get("internal_links", {})
	internal_and_external_links = links.get("internal_and_external_links", {})

	linked_documents = []
	for group in links.get("transactions", []):
		for linked_doctype in group["items"]:
			if linked_doctype not in DOCTYPES:
				continue

			internal_link = internal_links.get(linked_doctype) or internal_and_external_links.get(linked_doctype)
			names = []
			if internal_link:
				names = get_internal_links(doc, internal_link, linked_doctype)["names"]

			if not names and linked_doctype not in internal_links:
				names = get_external_names(linked_doctype, doc.name, links)

			linked_documents.extend((linked_doctype, name) for name in names)

	return linked_documents


def get_external_names(linked_doctype: str, name: str, links: dict) -> list[str]:
	"""Return names of documents that reference `name`, like frappe.desk.notifications.get_external_links."""
	fieldname = links.get("non_standard_fieldnames", {}).get(linked_doctype, links.get("fieldname"))
	filters = {fieldname: name}
	if dynamic_link_filters := get_dynamic_link_filters(linked_doctype, links, fieldname):
		filters.update(dynamic_link_filters)

	return frappe.get_all(
		linked_doctype,
		filters=filters,
		pluck="name",
		distinct=True,
		order_by=None,
		limit=MAX_DOCUMENTS,
	)


def get_preview(content: str | None) -> str:
	"""Return the first lines of the email as plain text, without quoted replies."""
	text = html2text(content or "", strip_links=True, wrap=False)
	lines = [line.strip() for line in text.splitlines()]
	own_lines = [line for line in lines if line and not line.startswith(">")]
	return " ".join(own_lines)[:PREVIEW_LENGTH]
