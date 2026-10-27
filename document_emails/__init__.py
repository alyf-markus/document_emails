__version__ = "0.0.1"

# Documents that get the "Emails" tab. Only connections between these DocTypes are followed.
# Keep in sync with public/js/document_emails.bundle.js
DOCTYPES = [
	# Selling
	"Quotation",
	"Sales Order",
	"Delivery Note",
	"Sales Invoice",
	# Buying
	"Material Request",
	"Request for Quotation",
	"Supplier Quotation",
	"Purchase Order",
	"Purchase Receipt",
	"Purchase Invoice",
]
