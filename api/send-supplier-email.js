/**
 * MUREZA / MAVE Supplier Portal - Email Notification Service
 * Powered by Resend (https://resend.com)
 * Compatible with Vercel Serverless Functions and Node.js
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    type = "registration_received",
    to,
    companyName = "Supplier Applicant",
    contactName = "Manufacturing Partner",
    trackingCode = "MVR-2026-0000",
    tierTitle = "Tier 1 - Major Systems",
    status = "Pending Review",
    reviewerNotes = "",
    apiKey: customApiKey,
    senderEmail
  } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: "Missing required 'to' email parameter" });
  }

  const resendApiKey = customApiKey || process.env.RESEND_API_KEY;
  const from = senderEmail || process.env.RESEND_FROM_EMAIL || "MAVE <onboarding@mave.africa>";

  // Determine email subject & HTML body based on event type
  let subject = `MAVE Supplier Dossier: ${trackingCode}`;
  let html = "";

  if (type === "registration_received") {
    subject = `MAVE / MUREZA Supplier Registration Confirmed — Ref: ${trackingCode}`;
    html = generateRegistrationReceivedHtml({
      companyName,
      contactName,
      trackingCode,
      tierTitle
    });
  } else if (type === "status_update" || type === "tier_allocated") {
    subject = `MAVE Supplier Update: ${companyName} — Status: ${status} (${trackingCode})`;
    html = generateStatusUpdateHtml({
      companyName,
      contactName,
      trackingCode,
      tierTitle,
      status,
      reviewerNotes
    });
  } else if (type === "tender_bid_received") {
    subject = `MUREZA Tender Proposal Logged — Bid Ref: ${trackingCode}`;
    html = generateGenericNoticeHtml({
      companyName,
      contactName,
      trackingCode,
      message: reviewerNotes || `Your commercial and technical proposal for ${tierTitle} has been recorded in the MUREZA OEM Tender Pipeline.`
    });
  } else if (type === "tender_award") {
    subject = `MUREZA OEM Procurement Notice: ${tierTitle} — ${status}`;
    html = generateGenericNoticeHtml({
      companyName,
      contactName,
      trackingCode,
      message: reviewerNotes || `Your proposal has been updated to ${status}. Our procurement lead will contact you regarding contract finalization.`
    });
  } else {
    subject = `MAVE Supplier Network Communication — ${trackingCode}`;
    html = generateGenericNoticeHtml({
      companyName,
      contactName,
      trackingCode,
      message: reviewerNotes || "Your supplier dossier has been updated in our procurement records."
    });
  }

  // If no Resend API key is configured, log in simulation mode
  if (!resendApiKey) {
    console.log(`[Email Simulated] To: ${to} | Subject: ${subject} | Ref: ${trackingCode}`);
    return res.status(200).json({
      success: true,
      simulated: true,
      message: "Email queued in simulation mode (set RESEND_API_KEY environment variable to dispatch live).",
      recipient: to,
      trackingCode
    });
  }

  // Dispatch live via Resend API
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: "suppliers@mave.africa",
        subject,
        html
      })
    });

    const data = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[Resend Error]", data);
      return res.status(resendRes.status).json({
        success: false,
        error: data.message || "Failed to dispatch email via Resend"
      });
    }

    return res.status(200).json({
      success: true,
      emailId: data.id,
      trackingCode
    });
  } catch (error) {
    console.error("[Resend Fetch Error]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error dispatching email"
    });
  }
}

// ============================================================
// LUXURY MAVE EMAIL TEMPLATES (DARK & GOLD BRANDING)
// ============================================================

function generateRegistrationReceivedHtml({ companyName, contactName, trackingCode, tierTitle }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MAVE Supplier Registration</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0907; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ede8df;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0907; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #14110e; border: 1px solid rgba(207, 143, 69, 0.25); border-radius: 8px; overflow: hidden; max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left; border-bottom: 1px solid rgba(207, 143, 69, 0.15);">
              <span style="font-size: 11px; letter-spacing: 0.2em; color: #cf8f45; text-transform: uppercase; font-weight: 700;">
                MUREZA OEM GROUP / AfCFTA LOCALIZATION PROGRAM
              </span>
              <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 600; color: #f5f2eb; letter-spacing: -0.02em;">
                Supplier Registration Confirmed
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px; line-height: 1.6; font-size: 15px; color: #c4beb4;">
              <p style="margin-top: 0;">Dear <strong>${escapeXml(contactName)}</strong> (${escapeXml(companyName)}),</p>
              
              <p>
                We have received your company profile and technical qualification documentation for the MUREZA continental automotive component supply chain.
              </p>

              <!-- Tracking Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(207, 143, 69, 0.08); border: 1px solid rgba(207, 143, 69, 0.3); border-radius: 6px; margin: 28px 0; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #9c9588;">Dossier Tracking Reference</div>
                    <div style="font-size: 26px; font-weight: 700; color: #cf8f45; letter-spacing: 0.05em; margin: 6px 0;">${escapeXml(trackingCode)}</div>
                    <div style="font-size: 13px; color: #ede8df;">Target Tier: <strong>${escapeXml(tierTitle)}</strong></div>
                    <div style="font-size: 12px; color: #8fa89b; margin-top: 4px;">Status: Pilot Onboarding — Fee Waived (Free Application)</div>
                  </td>
                </tr>
              </table>

              <p style="margin-bottom: 24px;">
                Our supplier industrialization team is inspecting your capabilities, manufacturing facility footprint, and quality compliance records against our 240 localized EV component BOM specifications.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="background-color: #cf8f45; border-radius: 4px;">
                    <a href="https://suppliers.mave.africa/#tracking-section" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0b0907; text-decoration: none;">
                      Track Application Status &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #8c857b; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px;">
                Keep your tracking reference safe. You can check audit updates and tier allocation notices at any time directly on the supplier portal.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0e0c0a; border-top: 1px solid rgba(207, 143, 69, 0.12); font-size: 11px; color: #6e675d; text-align: left;">
              <div style="color: #cf8f45; font-weight: 600; margin-bottom: 4px;">MUREZA / MAVE AUTOMOTIVE GROUP</div>
              <div>Pan-African Special Economic Zones | South Africa &bull; Ethiopia &bull; Kenya</div>
              <div style="margin-top: 8px;">Inquiries: <a href="mailto:suppliers@mave.africa" style="color: #cf8f45; text-decoration: none;">suppliers@mave.africa</a></div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateStatusUpdateHtml({ companyName, contactName, trackingCode, tierTitle, status, reviewerNotes }) {
  const isApproved = status.toLowerCase() === "approved" || status.toLowerCase() === "tier_assigned";
  const statusColor = isApproved ? "#68d391" : "#cf8f45";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MAVE Supplier Status Update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0907; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ede8df;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0907; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #14110e; border: 1px solid rgba(207, 143, 69, 0.25); border-radius: 8px; overflow: hidden; max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left; border-bottom: 1px solid rgba(207, 143, 69, 0.15);">
              <span style="font-size: 11px; letter-spacing: 0.2em; color: #cf8f45; text-transform: uppercase; font-weight: 700;">
                MUREZA OEM GROUP / SUPPLIER QUALIFICATION
              </span>
              <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 600; color: #f5f2eb; letter-spacing: -0.02em;">
                Dossier Status Update
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px; line-height: 1.6; font-size: 15px; color: #c4beb4;">
              <p style="margin-top: 0;">Dear <strong>${escapeXml(contactName)}</strong>,</p>
              
              <p>
                An update has been registered regarding the automotive manufacturing qualification for <strong>${escapeXml(companyName)}</strong> under reference <strong>${escapeXml(trackingCode)}</strong>.
              </p>

              <!-- Status Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(207, 143, 69, 0.08); border: 1px solid rgba(207, 143, 69, 0.3); border-radius: 6px; margin: 24px 0; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #9c9588;">Current Application Standing</div>
                    <div style="font-size: 22px; font-weight: 700; color: ${statusColor}; text-transform: uppercase; margin: 8px 0;">
                      ${escapeXml(status.replace(/_/g, " "))}
                    </div>
                    <div style="font-size: 14px; color: #ede8df;">Allocated Category: <strong>${escapeXml(tierTitle)}</strong></div>
                  </td>
                </tr>
              </table>

              ${
                reviewerNotes
                  ? `
              <div style="background: rgba(255, 255, 255, 0.03); border-left: 3px solid #cf8f45; padding: 14px 18px; margin: 20px 0; border-radius: 0 4px 4px 0;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #cf8f45; font-weight: 700; margin-bottom: 4px;">Reviewer Directive & Notes:</div>
                <div style="font-size: 13px; color: #ddd7cd;">${escapeXml(reviewerNotes)}</div>
              </div>
              `
                  : ""
              }

              <p style="margin-bottom: 24px;">
                You can review the updated status and download any provisional qualification documentation directly using your tracking reference.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="background-color: #cf8f45; border-radius: 4px;">
                    <a href="https://suppliers.mave.africa/#tracking-section" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0b0907; text-decoration: none;">
                      View Live Dossier &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0e0c0a; border-top: 1px solid rgba(207, 143, 69, 0.12); font-size: 11px; color: #6e675d; text-align: left;">
              <div style="color: #cf8f45; font-weight: 600; margin-bottom: 4px;">MUREZA / MAVE AUTOMOTIVE GROUP</div>
              <div>Inquiries: <a href="mailto:suppliers@mave.africa" style="color: #cf8f45; text-decoration: none;">suppliers@mave.africa</a></div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateGenericNoticeHtml({ companyName, contactName, trackingCode, message }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background-color: #0b0907; font-family: sans-serif; color: #ede8df; padding: 40px;">
  <h2>MAVE Supplier Network Notification</h2>
  <p>Dear ${escapeXml(contactName)} (${escapeXml(companyName)}),</p>
  <p>Reference: <strong>${escapeXml(trackingCode)}</strong></p>
  <p>${escapeXml(message)}</p>
  <p>Inquiries: <a href="mailto:suppliers@mave.africa" style="color: #cf8f45;">suppliers@mave.africa</a></p>
</body>
</html>
  `;
}

function escapeXml(unsafe = "") {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
