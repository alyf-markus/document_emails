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
			${get_email_days_html(emails)}
			<div class="no-emails text-muted text-center mt-3 ${emails.length ? "hidden" : ""}">
				${__("No Emails")}
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

function get_email_days_html(emails) {
	// emails come sorted by date, newest first
	const emails_by_day = new Map();
	for (const email of emails) {
		const day = email.communication_date.slice(0, 10);
		if (!emails_by_day.has(day)) emails_by_day.set(day, []);
		emails_by_day.get(day).push(email);
	}

	return [...emails_by_day.entries()]
		.map(([day, day_emails]) => {
			const weekday = frappe.datetime
				.str_to_obj(day)
				.toLocaleDateString(frappe.boot.lang, { weekday: "long" });
			return `
				<div class="email-day">
					<div class="email-day-title">${weekday}, ${frappe.datetime.str_to_user(day)}</div>
					${day_emails.map(get_email_card_html).join("")}
				</div>
			`;
		})
		.join("");
}

function get_email_card_html(email) {
	const escape = frappe.utils.escape_html;
	const sender = email.sender_full_name || email.sender || "";
	const time = frappe.datetime.str_to_user(email.communication_date).split(" ")[1];
	const direction_color = email.sent_or_received === "Sent" ? "blue" : "green";
	const document_url = frappe.utils.get_form_link(email.document_doctype, email.document_name);
	const communication_url = frappe.utils.get_form_link("Communication", email.name);

	return `
		<div class="email-item" data-name="${escape(email.name)}"
			data-document-type="${escape(email.document_doctype)}" data-direction="${escape(email.sent_or_received)}">
			<b class="email-time">${time}</b>
			<div class="email-body">
				<div class="email-line">
					<b>${escape(email.subject || __("No Subject"))}</b>
					<span>
						<span class="indicator-pill ${direction_color}">${__(email.sent_or_received)}</span>
						<a class="small" href="${document_url}">
							${__(email.document_doctype)}: ${escape(email.document_name)}
						</a>
						<a class="email-link" href="${communication_url}" title="${__("Open Communication")}">
							${frappe.utils.icon("link-url", "sm")}
						</a>
					</span>
				</div>
				<div class="text-muted small ellipsis">
					${escape(sender)} · ${__("To")}: ${escape(email.recipients || "")}
				</div>
				<div class="email-preview small ellipsis">${escape(email.preview)}</div>
				<div class="email-full hidden">${frappe.dom.remove_script_and_style(email.content || "")}</div>
			</div>
		</div>
	`;
}

function setup_email_list(frm, $wrapper) {
	$wrapper.find(".new-email").on("click", () => frm.timeline.compose_mail());

	// click on a card switches between preview and full email
	$wrapper.find(".email-item").on("click", (event) => {
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

		$wrapper.find(".email-day").each((_, day) => {
			const $day = $(day);
			$day.toggleClass("hidden", !$day.find(".email-item:not(.hidden)").length);
		});

		$wrapper.find(".no-emails").toggleClass("hidden", visible_count > 0);
	});
}
