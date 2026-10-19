/**
 * MUREZA / MAVE Supplier Portal - Email Notification & Broadcast Service
 * Powered by Resend (https://resend.com)
 * Supports:
 *   1. Supplier Onboarding & Dossier Confirmation
 *   2. Evaluation & Status Updates
 *   3. Tender Bid Logging & Contract Awards
 *   4. Continental Broadcasts (Tender Announcements & General Supply Chain Updates)
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
    recipients = [],
    companyName = "Supplier Applicant",
    contactName = "Manufacturing Partner",
    trackingCode = "MVR-2026-0000",
    tierTitle = "Tier 1 - Major Systems",
    status = "Pending Review",
    reviewerNotes = "",
    // Broadcast specific fields:
    broadcastType = "tender", // 'tender' | 'general_update'
    subject: customSubject,
    headline,
    message,
    tender,
    actionLabel,
    actionUrl,
    apiKey: customApiKey,
    senderEmail
  } = req.body || {};

  const resendApiKey = customApiKey || process.env.RESEND_API_KEY;
  const from = senderEmail || process.env.RESEND_FROM_EMAIL || "MAVE <onboarding@mave.africa>";
  const isValidFormat = typeof resendApiKey === "string" && resendApiKey.trim().startsWith("re_");

  // ============================================================
  // A. BROADCAST DISPATCH LOGIC (MULTI-RECIPIENT)
  // ============================================================
  const isBroadcast = type.startsWith("broadcast") || (Array.isArray(recipients) && recipients.length > 0);

  if (isBroadcast) {
    const rawList = Array.isArray(recipients) && recipients.length > 0 ? recipients : (to ? [to] : []);
    const normalizedRecipients = rawList
      .map((item) => {
        if (typeof item === "string") return { email: item.trim(), name: "Partner", company: "Supplier Partner" };
        if (item && item.email) return {
          email: item.email.trim(),
          name: item.name || item.contactName || "Manufacturing Partner",
          company: item.company || item.companyName || "Supplier Partner"
        };
        return null;
      })
      .filter((r) => r && r.email && r.email.includes("@"));

    if (normalizedRecipients.length === 0) {
      return res.status(400).json({ error: "Missing or invalid recipient email list for broadcast" });
    }

    const defaultSubject = broadcastType === "tender"
      ? `[RFP OPPORTUNITY] MUREZA OEM Tender: ${tender?.ref || "RFP-2026"} — ${tender?.title || "Component Manufacturing"}`
      : `MAVE Supplier Network Communication: ${headline || "Supply Chain Update"}`;
    const broadcastSubject = customSubject || defaultSubject;

    // Simulation check
    if (!isValidFormat) {
      console.log(`[Broadcast Simulated] ${normalizedRecipients.length} recipients | Subject: ${broadcastSubject}`);
      return res.status(200).json({
        success: true,
        simulated: true,
        count: normalizedRecipients.length,
        recipients: normalizedRecipients.map((r) => r.email),
        subject: broadcastSubject,
        message: "Broadcast processed in simulation mode (valid RESEND_API_KEY starting with 're_' required for live inbox delivery)."
      });
    }

    // Live dispatch via Resend
    const results = [];
    for (const r of normalizedRecipients) {
      const emailHtml = broadcastType === "tender"
        ? generateTenderBroadcastHtml({
            companyName: r.company,
            contactName: r.name,
            tender: tender || {
              ref: "RFP-2026-CHASSIS-01",
              title: "Component Fabrication & Stamping Tooling",
              category: "General Component Manufacturing",
              volume: "15,000 sets / year",
              estimatedValue: "R 180,000,000",
              localContentPct: 60,
              deadline: "2026-12-15",
              scope: "Automotive component manufacturing under AfCFTA local content rules."
            },
            customMessage: message || ""
          })
        : generateAnnouncementBroadcastHtml({
            companyName: r.company,
            contactName: r.name,
            headline: headline || "Pan-African Supply Chain Initiative",
            message: message || "Important updates regarding the MUREZA supplier ecosystem.",
            actionLabel: actionLabel || "Visit Supplier Portal ↗",
            actionUrl: actionUrl || "https://suppliers.mave.africa"
          });

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from,
            to: [r.email],
            reply_to: "suppliers@mave.africa",
            subject: broadcastSubject,
            html: emailHtml
          })
        });
        const resData = await resp.json();
        results.push({ email: r.email, success: resp.ok, id: resData?.id, error: resData?.message });
      } catch (err) {
        results.push({ email: r.email, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return res.status(200).json({
      success: true,
      count: successCount,
      total: normalizedRecipients.length,
      subject: broadcastSubject,
      results
    });
  }

  // ============================================================
  // B. SINGLE DIRECT NOTIFICATION DISPATCH
  // ============================================================
  if (!to) {
    return res.status(400).json({ error: "Missing required 'to' email parameter" });
  }

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

  if (!isValidFormat) {
    console.log(`[Email Simulated - Key format invalid or missing] To: ${to} | Subject: ${subject} | Ref: ${trackingCode}`);
    return res.status(200).json({
      success: true,
      simulated: true,
      message: "Email logged in simulation mode (valid RESEND_API_KEY starting with 're_' required for live delivery).",
      recipient: to,
      trackingCode
    });
  }

  // Dispatch live via Resend API
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey.trim()}`,
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
      console.warn("[Resend Warning]", data);
      return res.status(200).json({
        success: false,
        simulated: true,
        error: data.message || "Failed to dispatch email via Resend",
        note: "Email logged; submission was recorded successfully."
      });
    }

    return res.status(200).json({
      success: true,
      emailId: data.id,
      trackingCode
    });
  } catch (error) {
    console.warn("[Resend Fetch Error]", error);
    return res.status(200).json({
      success: false,
      simulated: true,
      error: error.message
    });
  }
}

// ============================================================
// HTML EMAIL TEMPLATE GENERATORS
// ============================================================

function generateTenderBroadcastHtml({ companyName, contactName, tender, customMessage }) {
  const portalUrl = "https://suppliers.mave.africa/#tenders-section";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MUREZA OEM Tender Opportunity</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060403; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ede8df;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #060403; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #120e0b; border: 1px solid rgba(207, 143, 69, 0.3); border-radius: 8px; overflow: hidden; max-width: 600px; width: 100%;">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #cf8f45, #ecc995, #cf8f45);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left; border-bottom: 1px solid rgba(207, 143, 69, 0.15);">
              <span style="font-size: 11px; letter-spacing: 0.2em; color: #cf8f45; text-transform: uppercase; font-weight: 700;">
                MUREZA OEM PROCUREMENT &bull; OFFICIAL RFP NOTICE
              </span>
              <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 600; color: #f5f2eb; letter-spacing: -0.02em; line-height: 1.3;">
                ${escapeXml(tender.title || "Automotive Component Manufacturing RFP")}
              </h1>
              <div style="margin-top: 8px; display: inline-block; padding: 4px 10px; background: rgba(207, 143, 69, 0.15); border: 1px solid #cf8f45; border-radius: 4px; font-size: 12px; font-weight: 700; color: #ecc995; letter-spacing: 0.08em;">
                REF: ${escapeXml(tender.ref || "RFP-2026-OEM")}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px; line-height: 1.6; font-size: 15px; color: #c4beb4;">
              <p style="margin-top: 0;">Dear <strong>${escapeXml(contactName)}</strong> (${escapeXml(companyName)}),</p>
              
              <p>
                The MUREZA OEM Procurement Committee has officially issued a request for commercial proposals and technical quotations under the African Continental Free Trade Area (AfCFTA) automotive localization framework.
              </p>

              ${customMessage ? `
              <div style="background: rgba(255, 255, 255, 0.03); border-left: 3px solid #cf8f45; padding: 14px 18px; margin: 20px 0; border-radius: 0 4px 4px 0; font-size: 14px; color: #ede8df;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #cf8f45; font-weight: 700; display: block; margin-bottom: 4px;">Executive Note from Procurement:</span>
                ${escapeXml(customMessage)}
              </div>` : ""}

              <!-- Tender Key Specs Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(207, 143, 69, 0.06); border: 1px solid rgba(207, 143, 69, 0.25); border-radius: 6px; margin: 24px 0; padding: 16px 20px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 11px; text-transform: uppercase; color: #9c9588;">Category:</span>
                    <strong style="color: #ede8df; display: block; margin-top: 2px;">${escapeXml(tender.category || "General Components")}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 11px; text-transform: uppercase; color: #9c9588;">Estimated Master Contract Value:</span>
                    <strong style="color: #ecc995; font-size: 16px; display: block; margin-top: 2px;">${escapeXml(tender.estimatedValue || "Competitive Tender")}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 11px; text-transform: uppercase; color: #9c9588;">Annual Off-take Volume:</span>
                    <strong style="color: #ede8df; display: block; margin-top: 2px;">${escapeXml(tender.volume || "As per RFP schedule")}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 11px; text-transform: uppercase; color: #9c9588;">Minimum African Local Content:</span>
                    <strong style="color: #68d391; display: block; margin-top: 2px;">${escapeXml(String(tender.localContentPct || 50))}% Domestic Value Addition</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #9c9588;">Official Submission Deadline:</span>
                    <strong style="color: #feb2b2; display: block; margin-top: 2px;">${escapeXml(tender.deadline || "Open until filled")}</strong>
                  </td>
                </tr>
              </table>

              ${tender.scope ? `
              <div style="margin: 20px 0;">
                <h4 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #cf8f45; margin-bottom: 6px;">Manufacturing Scope:</h4>
                <p style="font-size: 13px; color: #c4beb4; margin: 0; line-height: 1.5;">${escapeXml(tender.scope)}</p>
              </div>` : ""}

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" style="background-color: #cf8f45; border-radius: 4px;">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; padding: 15px 32px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0b0907; text-decoration: none;">
                      Inspect Tender &amp; Submit Proposal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #8c857b; margin-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px;">
                You are receiving this communication as a registered manufacturing entity in the MUREZA / MAVE Continental Supplier Network.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0a0806; border-top: 1px solid rgba(207, 143, 69, 0.12); font-size: 11px; color: #6e675d; text-align: left;">
              <div style="color: #cf8f45; font-weight: 600; margin-bottom: 4px;">MUREZA / MAVE AUTOMOTIVE GROUP &bull; PROCUREMENT DIVISION</div>
              <div>Pan-African Special Economic Zones | South Africa &bull; Ethiopia &bull; Kenya</div>
              <div style="margin-top: 6px;">Direct Inquiries: <a href="mailto:suppliers@mave.africa" style="color: #cf8f45; text-decoration: none;">suppliers@mave.africa</a></div>
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

function generateAnnouncementBroadcastHtml({ companyName, contactName, headline, message, actionLabel, actionUrl }) {
  const buttonUrl = actionUrl || "https://suppliers.mave.africa";
  const buttonText = actionLabel || "Visit Supplier Portal ↗";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MAVE Supplier Network Communication</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060403; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ede8df;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #060403; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #120e0b; border: 1px solid rgba(207, 143, 69, 0.3); border-radius: 8px; overflow: hidden; max-width: 600px; width: 100%;">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #cf8f45, #ecc995, #cf8f45);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left; border-bottom: 1px solid rgba(207, 143, 69, 0.15);">
              <span style="font-size: 11px; letter-spacing: 0.2em; color: #cf8f45; text-transform: uppercase; font-weight: 700;">
                MUREZA / MAVE &bull; SUPPLY CHAIN BROADCAST
              </span>
              <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 600; color: #f5f2eb; letter-spacing: -0.02em;">
                ${escapeXml(headline)}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px; line-height: 1.6; font-size: 15px; color: #c4beb4;">
              <p style="margin-top: 0;">Dear <strong>${escapeXml(contactName)}</strong> (${escapeXml(companyName)}),</p>
              
              <div style="font-size: 15px; color: #ede8df; line-height: 1.7; margin: 20px 0; white-space: pre-line;">
                ${escapeXml(message)}
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" style="background-color: #cf8f45; border-radius: 4px;">
                    <a href="${buttonUrl}" target="_blank" style="display: inline-block; padding: 14px 30px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0b0907; text-decoration: none;">
                      ${escapeXml(buttonText)}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #8c857b; margin-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px;">
                Broadcast sent to certified partners and applicants within the MUREZA Pan-African Automotive Localization Program.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0a0806; border-top: 1px solid rgba(207, 143, 69, 0.12); font-size: 11px; color: #6e675d; text-align: left;">
              <div style="color: #cf8f45; font-weight: 600; margin-bottom: 4px;">MUREZA / MAVE AUTOMOTIVE GROUP</div>
              <div>Pan-African Special Economic Zones | South Africa &bull; Ethiopia &bull; Kenya</div>
              <div style="margin-top: 6px;">Support: <a href="mailto:suppliers@mave.africa" style="color: #cf8f45; text-decoration: none;">suppliers@mave.africa</a></div>
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

function generateRegistrationReceivedHtml({ companyName, contactName, trackingCode, tierTitle }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MAVE Supplier Application Received</title>
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
                MUREZA OEM GROUP / STRATEGIC PARTNERSHIP
              </span>
              <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 600; color: #f5f2eb; letter-spacing: -0.02em;">
                Supplier Registration Confirmed
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px; line-height: 1.6; font-size: 15px; color: #c4beb4;">
              <p style="margin-top: 0;">Dear <strong>${escapeXml(contactName)}</strong>,</p>
              
              <p>
                Thank you for applying to onboard <strong>${escapeXml(companyName)}</strong> as a manufacturing partner for the MUREZA pan-African automotive program under the African Continental Free Trade Area (AfCFTA).
              </p>

              <!-- Reference Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(207, 143, 69, 0.08); border: 1px solid rgba(207, 143, 69, 0.3); border-radius: 6px; margin: 24px 0; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #9c9588;">Official Tracking Reference</div>
                    <div style="font-size: 26px; font-weight: 700; color: #ecc995; letter-spacing: 0.05em; margin: 6px 0;">
                      ${escapeXml(trackingCode)}
                    </div>
                    <div style="font-size: 13px; color: #cf8f45;">Selected Category: <strong>${escapeXml(tierTitle)}</strong></div>
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
