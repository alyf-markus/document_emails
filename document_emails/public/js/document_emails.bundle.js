// Keep in sync with DOCTYPES in document_emails/__init__.py
const DOCTYPES = [
	"Quotation",
	"Sales Order",
	"Delivery Note",
	"Sales Invoice",
	"Material Request",
	"Request for Quotation",
	"Supplier Quotation",
	"Purchase Order",
	"Purchase Receipt",
	"Purchase Invoice",
];

for (const doctype of DOCTYPES) {
	frappe.ui.form.on(doctype, { refresh: render_document_emails });
}

function render_document_emails(frm) {
	const $wrapper = frm.fields_dict.email_html.$wrapper;
	$wrapper.empty();
	if (frm.is_new()) return;

	frappe
		.call("document_emails.api.get_emails", { doctype: frm.doctype, name: frm.docname })
		.then((r) => {
			$wrapper.html(get_email_list_html(r.message));
			setup_email_list(frm, $wrapper);
		});
}

function get_email_list_html(emails) {
	const document_types = [...new Set(emails.map((email) => email.document_doctype))];
	const document_type_options = document_types.map((doctype) => ({
		value: doctype,
		label: __(doctype),
	}));
	const direction_options = [
		{ value: "Sent", label: __("Sent") },
		{ value: "Received", label: __("Received") },
	];

	return `
		<div class="document-emails">
			<div class="flex justify-between align-center" style="gap: var(--padding-sm)">
				<div class="flex" style="gap: var(--padding-sm)">
					${get_select_html("filter-document-type", __("Document Type"), document_type_options)}
					${get_select_html("filter-direction", __("Sent or Received"), direction_options)}
				</div>
				<button class="btn btn-secondary btn-xs new-email">
					${frappe.utils.icon("es-line-add", "xs")}
					${__("New Email")}
				</button>
			</div>
			<div class="new-timeline">
				<div class="timeline-items">
					${emails.map(get_email_card_html).join("")}
				</div>
				<div class="no-emails text-muted text-center ${emails.length ? "hidden" : ""}">
					${__("No Emails")}
				</div>
			</div>
		</div>
	`;
}

function get_select_html(class_name, placeholder, options) {
	// same markup as a Select control, so we get the standard dropdown arrow
	const options_html = options
		.map((option) => `<option value="${option.value}">${option.label}</option>`)
		.join("");

	return `
		<div class="frappe-control" data-fieldtype="Select" style="min-width: 180px">
			<div class="control-input">
				<select class="form-control input-xs ${class_name}">
					<option value="">${placeholder}: ${__("All")}</option>
					${options_html}
				</select>
				<div class="select-icon xs">${frappe.utils.icon("select", "xs")}</div>
			</div>
		</div>
	`;
}

function get_email_card_html(email) {
	// mirrors frappe/public/js/frappe/form/templates/timeline_message_box.html
	const escape = frappe.utils.escape_html;
	const sender = email.sender_full_name || email.sender || "";
	const direction_color = email.sent_or_received === "Sent" ? "blue" : "green";
	const document_url = frappe.utils.get_form_link(email.document_doctype, email.document_name);
	const communication_url = frappe.utils.get_form_link("Communication", email.name);

	return `
		<div class="timeline-item email-item" data-name="${escape(email.name)}"
			data-document-type="${escape(email.document_doctype)}" data-direction="${escape(email.sent_or_received)}">
			<div class="timeline-badge" title="${__("Email")}">${frappe.utils.icon("mail", "sm")}</div>
			<div class="timeline-content frappe-card" style="cursor: pointer">
				<div class="timeline-message-box">
					<span class="flex justify-between m-1 mb-3">
						<span class="text-color flex">
							<span class="margin-right">${frappe.avatar(email.sender, "avatar-medium")}</span>
							<div>
								${escape(sender)}
								<span> · </span>
								<span class="text-muted">${frappe.datetime.str_to_user(email.communication_date)}</span>
								<div class="my-1"><b>${escape(email.subject || __("No Subject"))}</b></div>
								<div class="text-muted small">${__("To")}: ${escape(email.recipients || "")}</div>
							</div>
						</span>
						<span class="actions" style="flex-shrink: 0; flex-direction: column;
							justify-content: space-between; align-items: flex-end">
							<span class="flex align-center" style="gap: var(--margin-sm)">
								<span class="indicator-pill ${direction_color}">
									<span class="small">${__(email.sent_or_received)}</span>
								</span>
								<a class="small" href="${document_url}" title="${__(email.document_doctype)}">
									${__(email.document_doctype)}: ${escape(email.document_name)}
								</a>
							</span>
							<!-- no .action-btn: inside a form field Frappe positions it absolutely in the corner -->
							<a href="${communication_url}" title="${__("Open Communication")}"
								style="--icon-stroke: var(--text-muted)">
								${frappe.utils.icon("link-url", "sm")}
							</a>
						</span>
					</span>
					<div class="content email-preview text-muted" style="display: -webkit-box;
						-webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden">
						${escape(email.preview)}
					</div>
					<div class="content email-full hidden">
						${frappe.dom.remove_script_and_style(email.content || "")}
					</div>
				</div>
			</div>
		</div>
	`;
}

function setup_email_list(frm, $wrapper) {
	$wrapper.find(".new-email").on("click", () => frm.timeline.compose_mail());

	// click on a card switches between preview and full email
	$wrapper.find(".email-item .timeline-content").on("click", (event) => {
		if ($(event.target).closest("a").length) return;

		const $card = $(event.currentTarget);
		$card.find(".email-preview, .email-full").toggleClass("hidden");
	});

	$wrapper.find(".filter-document-type, .filter-direction").on("change", () => {
		const document_type = $wrapper.find(".filter-document-type").val();
		const direction = $wrapper.find(".filter-direction").val();
		let visible_count = 0;

		$wrapper.find(".email-item").each((_, item) => {
			const $item = $(item);
			const visible =
				(!document_type || $item.attr("data-document-type") === document_type) &&
				(!direction || $item.attr("data-direction") === direction);
			$item.toggleClass("hidden", !visible);
			visible_count += visible;
		});

		$wrapper.find(".no-emails").toggleClass("hidden", visible_count > 0);
	});
}
