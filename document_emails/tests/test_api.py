import frappe
from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_invoice
from erpnext.buying.doctype.purchase_order.test_purchase_order import create_purchase_order
from erpnext.selling.doctype.quotation.quotation import make_sales_order
from erpnext.selling.doctype.quotation.test_quotation import make_quotation
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
from erpnext.tests.utils import ERPNextTestSuite
from frappe.utils import add_days, nowdate

from document_emails.api import get_emails, get_preview


class TestGetEmails(ERPNextTestSuite):
	def test_selling_chain_in_both_directions(self):
		quotation = make_quotation()
		sales_order = make_submitted_sales_order(quotation.name)
		sales_invoice = make_sales_invoice(sales_order.name)
		sales_invoice.insert()

		quotation_email = make_email("Quotation", quotation.name, "Angebot")
		invoice_email = make_email("Sales Invoice", sales_invoice.name, "Rechnung", as_timeline_link=True)

		emails = get_emails("Sales Order", sales_order.name)
		self.assertEqual(
			{(email.name, email.document_doctype) for email in emails},
			{(quotation_email, "Quotation"), (invoice_email, "Sales Invoice")},
		)

		emails = get_emails("Quotation", quotation.name)
		self.assertEqual({email.name for email in emails}, {quotation_email, invoice_email})

	def test_buying_chain(self):
		purchase_order = create_purchase_order()
		purchase_invoice = make_purchase_invoice(purchase_order.name)
		purchase_invoice.insert()

		order_email = make_email("Purchase Order", purchase_order.name, "Bestellung")

		emails = get_emails("Purchase Invoice", purchase_invoice.name)
		self.assertEqual([email.name for email in emails], [order_email])

	def test_skips_documents_the_user_cannot_read(self):
		sales_order = make_submitted_sales_order(make_quotation().name)
		purchase_order = create_purchase_order(do_not_save=True)
		purchase_order.items[0].sales_order = sales_order.name
		purchase_order.insert()
		# drop shipping links both ways; the Sales Order's Connections only use its own items
		frappe.db.set_value("Sales Order Item", sales_order.items[0].name, "purchase_order", purchase_order.name)

		sales_email = make_email("Sales Order", sales_order.name, "Auftrag")
		purchase_email = make_email("Purchase Order", purchase_order.name, "Bestellung")

		self.assertEqual(
			{email.name for email in get_emails("Sales Order", sales_order.name)},
			{sales_email, purchase_email},
		)

		with self.set_user(make_user("document-emails-sales@example.com", "Sales User")):
			emails = get_emails("Sales Order", sales_order.name)

		self.assertEqual([email.name for email in emails], [sales_email])

	def test_preview_skips_quoted_lines(self):
		content = "<p>Hallo,</p><p>anbei das Angebot.</p><blockquote><p>Alte Nachricht</p></blockquote>"
		self.assertEqual(get_preview(content), "Hallo, anbei das Angebot.")


def make_submitted_sales_order(quotation_name: str):
	sales_order = make_sales_order(quotation_name)
	sales_order.delivery_date = add_days(nowdate(), 10)
	sales_order.insert()
	sales_order.submit()
	return sales_order


def make_email(doctype: str, name: str, subject: str, as_timeline_link: bool = False) -> str:
	communication = frappe.new_doc("Communication")
	communication.communication_type = "Communication"
	communication.communication_medium = "Email"
	communication.sent_or_received = "Received"
	communication.sender = "kunde@example.com"
	communication.subject = subject
	communication.content = f"<p>{subject}</p>"
	if as_timeline_link:
		communication.add_link(doctype, name)
	else:
		communication.reference_doctype = doctype
		communication.reference_name = name

	communication.insert(ignore_permissions=True)
	return communication.name


def make_user(email: str, role: str) -> str:
	user = frappe.new_doc("User")
	user.email = email
	user.first_name = "Document Emails"
	user.append("roles", {"role": role})
	user.insert(ignore_permissions=True)
	return user.name
