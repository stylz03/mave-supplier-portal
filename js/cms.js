/* ============================================================
   MUREZA / MAVE Supplier Portal — CMS Logic & Administration Controller
   Manages real-time data sync, tier creation, pricing adjustments,
   supplier document review, and applicant tier assignment.
   ============================================================ */

import {
  onSiteContentSnapshot,
  saveSiteContent,
  onTiersSnapshot,
  saveTier,
  deleteTier,
  onSubmissionsSnapshot,
  updateSubmission,
  submitSupplierRegistration,
  onNotificationsSnapshot,
  markNotificationRead,
  setFirebaseApiKey,
  DEFAULT_PAGE_CONTENT,
  DEFAULT_TIERS
} from "./firebase-client.js";

// --- State Cache ---
let state = {
  content: { ...DEFAULT_PAGE_CONTENT },
  tiers: [...DEFAULT_TIERS],
  submissions: [],
  notifications: [],
  activeFilter: "all",
  activeSubmission: null,
  activeTierEdit: null
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupFilterButtons();
  setupSearch();
  setupModals();
  setupContentForm();
  setupTierForm();
  setupNotificationCenter();
  setupSeedDemo();

  // 1. Subscribe to Page Content
  onSiteContentSnapshot((content) => {
    state.content = content;
    populateContentForm(content);
  });

  // 2. Subscribe to Tiers
  onTiersSnapshot((tiers) => {
    state.tiers = tiers;
    renderTiersGrid();
    updateCapacityMetrics();
    populateTierAssignmentOptions();
  });

  // 3. Subscribe to Supplier Submissions
  onSubmissionsSnapshot((submissions) => {
    const prevCount = state.submissions.length;
    state.submissions = submissions;
    renderSubmissions();
    updateOverviewMetrics();

    // If new submission arrived while viewing
    if (prevCount > 0 && submissions.length > prevCount) {
      showToast("🔔 New supplier application received!");
    }
  });

  // 4. Subscribe to Notifications
  onNotificationsSnapshot((notifications) => {
    state.notifications = notifications;
    renderNotifications();
  });
});

// ============================================================
// UI NAVIGATION & TABS
// ============================================================

function setupTabs() {
  const tabs = document.querySelectorAll(".cms-nav-item");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = tab.dataset.tab;
      document.querySelectorAll(".cms-tab-content").forEach((c) => {
        c.classList.remove("active");
      });
      const activeContent = document.getElementById(targetId);
      if (activeContent) activeContent.classList.add("active");
    });
  });
}

// ============================================================
// NOTIFICATION CENTER
// ============================================================

function setupNotificationCenter() {
  const bell = document.getElementById("notifBellBtn");
  const dropdown = document.getElementById("notifDropdown");
  const clearBtn = document.getElementById("markAllReadBtn");

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove("open");
    }
  });

  clearBtn.addEventListener("click", () => {
    state.notifications.forEach((n) => {
      if (!n.read) markNotificationRead(n.id);
    });
    dropdown.classList.remove("open");
  });
}

function renderNotifications() {
  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const pill = document.getElementById("notifCountPill");
  if (pill) {
    pill.textContent = unreadCount;
    pill.style.display = unreadCount > 0 ? "inline-block" : "none";
  }

  const dropdownList = document.getElementById("notifList");
  const fullList = document.getElementById("fullNotifList");

  if (state.notifications.length === 0) {
    const emptyHtml = `<div style="padding: 24px; text-align: center; color: var(--ink-faint); font-size: 13px;">No notifications yet.</div>`;
    if (dropdownList) dropdownList.innerHTML = emptyHtml;
    if (fullList) fullList.innerHTML = emptyHtml;
    return;
  }

  const html = state.notifications
    .slice(0, 15)
    .map(
      (n) => `
      <div class="notif-item ${n.read ? "" : "unread"}" onclick="window.handleNotificationClick('${n.id}', '${n.submissionId}')">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-msg">${escapeHtml(n.message)}</div>
        <div class="notif-item-time">${formatDate(n.createdAt)}</div>
      </div>
    `
    )
    .join("");

  if (dropdownList) dropdownList.innerHTML = html;
  if (fullList) fullList.innerHTML = html;
}

window.handleNotificationClick = (notifId, submissionId) => {
  markNotificationRead(notifId);
  const dropdown = document.getElementById("notifDropdown");
  if (dropdown) dropdown.classList.remove("open");

  if (submissionId) {
    const sub = state.submissions.find((s) => s.id === submissionId);
    if (sub) {
      window.openDossierModal(sub);
      return;
    }
  }
  document.querySelector('[data-tab="tab-submissions"]').click();
};

// ============================================================
// METRICS & OVERVIEW
// ============================================================

function updateOverviewMetrics() {
  const total = state.submissions.length;
  const pending = state.submissions.filter((s) => s.status === "pending").length;
  const approved = state.submissions.filter((s) => s.status === "approved").length;

  document.getElementById("statTotalApps").textContent = total;
  document.getElementById("statPendingApps").textContent = pending;
  document.getElementById("statApprovedApps").textContent = approved;

  const pendingBadge = document.getElementById("pendingBadge");
  if (pendingBadge) {
    pendingBadge.textContent = pending;
    pendingBadge.style.display = pending > 0 ? "inline-block" : "none";
  }

  // Update filter counters
  document.getElementById("countFilterAll").textContent = total;
  document.getElementById("countFilterPending").textContent = pending;
  document.getElementById("countFilterReview").textContent = state.submissions.filter((s) => s.status === "under_review").length;
  document.getElementById("countFilterTier").textContent = state.submissions.filter((s) => s.status === "tier_assigned").length;
  document.getElementById("countFilterApproved").textContent = approved;
  document.getElementById("countFilterDeclined").textContent = state.submissions.filter((s) => s.status === "declined").length;

  renderOverviewRecentTable();
}

function updateCapacityMetrics() {
  const totalCapacity = state.tiers.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);
  const filledSlots = state.tiers.reduce((acc, t) => acc + (Number(t.filled) || 0), 0);
  const el = document.getElementById("statCapacityFilled");
  if (el) el.textContent = `${filledSlots} / ${totalCapacity || 50}`;
}

function renderOverviewRecentTable() {
  const tbody = document.getElementById("overviewRecentTable");
  if (!tbody) return;

  const recent = state.submissions.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--ink-faint); padding: 30px;">No applications recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent
    .map(
      (s) => `
    <tr>
      <td>
        <div class="company-cell">
          <span class="company-name">${escapeHtml(s.companyName)}</span>
          <span class="company-meta">${escapeHtml(s.trackingCode || s.id)}</span>
        </div>
      </td>
      <td>${escapeHtml(s.country || "—")}</td>
      <td><span style="color: var(--ink-faint); font-weight: 500;">${getTierLabel(s.selectedTier)}</span></td>
      <td><span style="color: var(--gold); font-weight: 600;">${getTierLabel(s.assignedTier)}</span></td>
      <td><span class="status-pill status-${s.status || "pending"}">${formatStatus(s.status)}</span></td>
      <td>${s.documents ? s.documents.length : 0} files</td>
      <td>${formatDate(s.submittedAt)}</td>
      <td>
        <button class="cms-btn cms-btn-outline" style="padding: 4px 10px; font-size: 11px;" onclick="window.openDossierById('${s.id}')">
          Review &amp; Assign
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// ============================================================
// SUPPLIER APPLICATION PIPELINE & REVIEW (CORE USER REQUIREMENT)
// ============================================================

function setupFilterButtons() {
  const buttons = document.querySelectorAll(".sub-filter-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("cms-btn-gold");
        b.classList.add("cms-btn-outline");
      });
      btn.classList.remove("cms-btn-outline");
      btn.classList.add("cms-btn-gold");

      state.activeFilter = btn.dataset.filter;
      renderSubmissions();
    });
  });
}

function setupSearch() {
  const input = document.getElementById("submissionSearchInput");
  if (input) {
    input.addEventListener("input", () => {
      renderSubmissions();
    });
  }
}

function renderSubmissions() {
  const tbody = document.getElementById("allSubmissionsTable");
  if (!tbody) return;

  const search = (document.getElementById("submissionSearchInput")?.value || "").toLowerCase().trim();

  let filtered = state.submissions;
  if (state.activeFilter !== "all") {
    filtered = filtered.filter((s) => s.status === state.activeFilter);
  }

  if (search) {
    filtered = filtered.filter(
      (s) =>
        (s.companyName || "").toLowerCase().includes(search) ||
        (s.trackingCode || "").toLowerCase().includes(search) ||
        (s.country || "").toLowerCase().includes(search) ||
        (s.contactName || "").toLowerCase().includes(search) ||
        (s.contactEmail || "").toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--ink-faint); padding: 40px;">No applications found matching the selected criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (s) => `
    <tr>
      <td><span style="font-family: monospace; color: var(--gold); font-weight: 600;">${escapeHtml(s.trackingCode || "—")}</span></td>
      <td>
        <div class="company-cell">
          <span class="company-name">${escapeHtml(s.companyName)}</span>
          <span class="company-meta">${escapeHtml(s.primaryCategory || "Manufacturing")}</span>
        </div>
      </td>
      <td>
        <div>${escapeHtml(s.contactName || "—")}</div>
        <div style="font-size: 11px; color: var(--ink-faint);">${escapeHtml(s.contactEmail || "")}</div>
      </td>
      <td>${escapeHtml(s.country || "—")}</td>
      <td><span style="color: var(--ink-faint); font-weight: 500;">${getTierLabel(s.selectedTier)}</span></td>
      <td><span style="color: var(--gold); font-weight: 700;">${getTierLabel(s.assignedTier)}</span></td>
      <td><span class="status-pill status-${s.status || "pending"}">${formatStatus(s.status)}</span></td>
      <td>
        <span style="font-size: 12px; font-weight: 600;">${s.documents ? s.documents.length : 0} Docs</span>
      </td>
      <td>
        <button class="cms-btn cms-btn-outline" style="padding: 6px 12px; font-size: 11px;" onclick="window.openDossierById('${s.id}')">
          Inspect &amp; Assign Tier →
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// ============================================================
// DOSSIER EVALUATION & TIER ASSIGNMENT MODAL
// ============================================================

window.openDossierById = (id) => {
  const sub = state.submissions.find((s) => s.id === id);
  if (sub) window.openDossierModal(sub);
};

window.openDossierModal = (sub) => {
  state.activeSubmission = sub;

  document.getElementById("dossierTrackingCode").textContent = sub.trackingCode || sub.id;
  document.getElementById("dossierCompanyName").textContent = sub.companyName;
  document.getElementById("dossierRegNo").textContent = sub.registrationNumber || "Not specified";
  document.getElementById("dossierCountry").textContent = sub.country || "—";
  document.getElementById("dossierContact").textContent = `${sub.contactName || "—"} (${sub.contactRole || "Contact"})`;
  document.getElementById("dossierContactDetails").innerHTML = `
    <a href="mailto:${sub.contactEmail}" style="color: var(--gold); text-decoration: underline;">${sub.contactEmail}</a> 
    ${sub.contactPhone ? `<span style="color: var(--ink-faint);">| ${sub.contactPhone}</span>` : ""}
  `;
  document.getElementById("dossierCategory").textContent = sub.primaryCategory || "Automotive Component Fabrication";
  document.getElementById("dossierSelectedTier").textContent = getTierLabel(sub.selectedTier);
  document.getElementById("dossierCapability").textContent = sub.capabilitySummary || "No detailed capability statement submitted.";

  // Render submitted documents
  const docsList = document.getElementById("dossierDocsList");
  const countEl = document.getElementById("dossierDocCount");
  const docs = sub.documents || [];
  countEl.textContent = `${docs.length} File${docs.length === 1 ? "" : "s"}`;

  if (docs.length === 0) {
    docsList.innerHTML = `<div style="color: var(--ink-faint); font-size: 12px; padding: 12px; background: rgba(10,7,5,0.3); border-radius: 4px;">No documents uploaded with this submission.</div>`;
  } else {
    docsList.innerHTML = docs
      .map(
        (doc, i) => `
      <div class="doc-item">
        <div class="doc-info">
          <span class="doc-icon">📄</span>
          <div>
            <div class="doc-name">${escapeHtml(doc.name || `Document_${i + 1}.pdf`)}</div>
            <div class="doc-meta">${formatFileSize(doc.size)} • ${formatDate(doc.uploadedAt)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="${doc.url || "#"}" target="_blank" class="cms-btn cms-btn-outline" style="padding: 6px 12px; font-size: 11px;">
            View / Download ↗
          </a>
        </div>
      </div>
    `
      )
      .join("");
  }

  // Populate Tier selection dropdown
  populateTierAssignmentOptions(sub.assignedTier || sub.selectedTier);

  // Set current status and notes
  document.getElementById("dossierStatusSelect").value = sub.status || "pending";
  document.getElementById("dossierNotesInput").value = sub.reviewerNotes || "";

  document.getElementById("dossierModal").classList.add("open");
};

window.closeDossierModal = () => {
  document.getElementById("dossierModal").classList.remove("open");
  state.activeSubmission = null;
};

function populateTierAssignmentOptions(selectedTierId) {
  const select = document.getElementById("dossierAssignTierSelect");
  if (!select) return;

  select.innerHTML = state.tiers
    .map(
      (t) => `
    <option value="${t.id}" ${t.id === selectedTierId ? "selected" : ""}>
      ${escapeHtml(t.title)} (${escapeHtml(t.sub)}) — Fee: ${escapeHtml(t.feeFormatted || "R " + t.feeAmount)}
    </option>
  `
    )
    .join("");
}

function setupModals() {
  // Save Evaluation & Assign Tier button
  const saveEvalBtn = document.getElementById("saveDossierEvaluationBtn");
  if (saveEvalBtn) {
    saveEvalBtn.addEventListener("click", async () => {
      if (!state.activeSubmission) return;

      const assignedTier = document.getElementById("dossierAssignTierSelect").value;
      const status = document.getElementById("dossierStatusSelect").value;
      const notes = document.getElementById("dossierNotesInput").value;

      saveEvalBtn.textContent = "Saving...";
      saveEvalBtn.disabled = true;

      try {
        await updateSubmission(state.activeSubmission.id, {
          assignedTier,
          status,
          reviewerNotes: notes
        });

        showToast(`✓ Evaluation saved! ${state.activeSubmission.companyName} assigned to ${getTierLabel(assignedTier)}.`);
        closeDossierModal();
      } catch (err) {
        showToast("Error updating application: " + err.message);
      } finally {
        saveEvalBtn.textContent = "Save Evaluation & Assign Tier";
        saveEvalBtn.disabled = false;
      }
    });
  }
}

// ============================================================
// TIERS & PRICING MANAGEMENT (CORE USER REQUIREMENT)
// ============================================================

function renderTiersGrid() {
  const grid = document.getElementById("tiersAdminGrid");
  if (!grid) return;

  grid.innerHTML = state.tiers
    .map((tier) => {
      const pct = Math.min(100, Math.round(((Number(tier.filled) || 0) / (Number(tier.capacity) || 1)) * 100));
      const focusList = Array.isArray(tier.focus) ? tier.focus : (tier.focus || "").split("\n").filter(Boolean);

      return `
      <div class="tier-admin-card" style="border-top: 3px solid ${tier.color || "var(--gold)"};">
        <div class="tier-card-header">
          <div>
            <div class="tier-card-title">${escapeHtml(tier.title)}</div>
            <div class="tier-card-sub" style="color: ${tier.color || "var(--gold)"};">${escapeHtml(tier.sub)}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="cms-btn cms-btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="window.editTier('${tier.id}')">Edit</button>
            <button class="cms-btn cms-btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="window.deleteTierById('${tier.id}')">✕</button>
          </div>
        </div>

        <!-- Capacity indicator -->
        <div class="tier-capacity-bar">
          <div class="tier-capacity-labels">
            <span>Capacity Allocation</span>
            <span style="font-weight: 600; color: var(--ink);">${tier.filled || 0} / ${tier.capacity || 10} Slots (${pct}%)</span>
          </div>
          <div class="tier-progress-track">
            <div class="tier-progress-fill" style="width: ${pct}%; background: ${tier.color || "var(--gold)"};"></div>
          </div>
        </div>

        <!-- Pricing box -->
        <div class="tier-fee-box">
          <div>
            <div class="tier-fee-term">${escapeHtml(tier.feeFrequency || "Once-off Qualification Fee")}</div>
            <div class="tier-fee-amount">${escapeHtml(tier.feeFormatted || formatCurrency(tier.feeAmount, tier.feeCurrency))}</div>
          </div>
          <span class="status-pill status-approved" style="font-size: 10px;">PRICING ACTIVE</span>
        </div>

        <!-- Deliverables -->
        <div style="font-size: 12px; color: var(--ink-dim); flex: 1;">
          <div style="font-size: 10px; letter-spacing: 0.1em; color: var(--ink-faint); text-transform: uppercase; margin-bottom: 6px;">
            Target Deliverables &amp; Focus
          </div>
          <ul style="padding-left: 16px; line-height: 1.6;">
            ${focusList.slice(0, 4).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(207,143,69,0.15); padding-top: 12px; font-size: 11px; color: var(--ink-faint);">
          <span>Code: ${escapeHtml(tier.code || tier.id)}</span>
          <button class="cms-btn cms-btn-outline" style="padding: 4px 8px; font-size: 10px;" onclick="window.editTier('${tier.id}')">
            Adjust Pricing / Slots
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

function setupTierForm() {
  const addBtn = document.getElementById("addNewTierBtn");
  const saveBtn = document.getElementById("saveTierBtn");

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      window.openTierModal();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const id = document.getElementById("editTierId").value || `tier_${Date.now()}`;
      const code = document.getElementById("tierEditCode").value.trim() || "TIER";
      const sub = document.getElementById("tierEditSub").value.trim() || "GENERAL";
      const capacity = Number(document.getElementById("tierEditCapacity").value) || 10;
      const filled = Number(document.getElementById("tierEditFilled").value) || 0;
      const feeAmount = Number(document.getElementById("tierEditFeeAmount").value) || 0;
      const feeCurrency = document.getElementById("tierEditCurrency").value || "ZAR";
      const feeFrequency = document.getElementById("tierEditFeeFrequency").value.trim() || "Once-off Qualification Fee";
      const color = document.getElementById("tierEditColor").value || "#cf8f45";
      const focusText = document.getElementById("tierEditFocus").value;
      const requirements = document.getElementById("tierEditRequirements").value;

      const focus = focusText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const feeFormatted = formatCurrency(feeAmount, feeCurrency);

      const tierData = {
        id,
        code,
        title: code,
        sub,
        capacity,
        filled,
        feeAmount,
        feeCurrency,
        feeFormatted,
        feeFrequency,
        color,
        focus,
        requirements,
        status: "Active"
      };

      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        await saveTier(tierData);
        showToast(`✓ Tier ${code} saved successfully!`);
        closeTierModal();
      } catch (err) {
        showToast("Error saving tier: " + err.message);
      } finally {
        saveBtn.textContent = "Save Tier";
        saveBtn.disabled = false;
      }
    });
  }
}

window.openTierModal = (tier = null) => {
  const modal = document.getElementById("tierEditModal");
  const title = document.getElementById("tierModalTitle");

  if (tier) {
    title.textContent = `Edit Tier: ${tier.title}`;
    document.getElementById("editTierId").value = tier.id;
    document.getElementById("tierEditCode").value = tier.code || tier.title;
    document.getElementById("tierEditSub").value = tier.sub || "";
    document.getElementById("tierEditCapacity").value = tier.capacity || 10;
    document.getElementById("tierEditFilled").value = tier.filled || 0;
    document.getElementById("tierEditFeeAmount").value = tier.feeAmount || 30000;
    document.getElementById("tierEditCurrency").value = tier.feeCurrency || "ZAR";
    document.getElementById("tierEditFeeFrequency").value = tier.feeFrequency || "Once-off Qualification Fee";
    document.getElementById("tierEditColor").value = tier.color || "#cf8f45";
    document.getElementById("tierEditFocus").value = Array.isArray(tier.focus) ? tier.focus.join("\n") : tier.focus || "";
    document.getElementById("tierEditRequirements").value = tier.requirements || "";
  } else {
    title.textContent = "Create New Tier";
    document.getElementById("editTierId").value = "";
    document.getElementById("tierEditCode").value = `TIER ${state.tiers.length + 1}`;
    document.getElementById("tierEditSub").value = "SYSTEMS & SUB-ASSEMBLY";
    document.getElementById("tierEditCapacity").value = 10;
    document.getElementById("tierEditFilled").value = 0;
    document.getElementById("tierEditFeeAmount").value = 25000;
    document.getElementById("tierEditCurrency").value = "ZAR";
    document.getElementById("tierEditFeeFrequency").value = "Once-off Qualification Fee";
    document.getElementById("tierEditColor").value = "#cf8f45";
    document.getElementById("tierEditFocus").value = "Specialized manufacturing\nQuality testing\nProduction scaling";
    document.getElementById("tierEditRequirements").value = "Quality management ISO certification";
  }

  modal.classList.add("open");
};

window.closeTierModal = () => {
  document.getElementById("tierEditModal").classList.remove("open");
};

window.editTier = (id) => {
  const t = state.tiers.find((tier) => tier.id === id);
  if (t) window.openTierModal(t);
};

window.deleteTierById = async (id) => {
  const t = state.tiers.find((tier) => tier.id === id);
  if (!t) return;
  if (!confirm(`Are you sure you want to delete ${t.title}? This will also remove it from the live portal.`)) return;

  try {
    await deleteTier(id);
    showToast(`Deleted ${t.title}`);
  } catch (err) {
    showToast("Error deleting tier: " + err.message);
  }
};

// ============================================================
// PAGE CONTENT CMS
// ============================================================

function populateContentForm(content) {
  document.getElementById("fieldDisplayWord").value = content.displayWord || "PARTNERS";
  document.getElementById("fieldKicker").value = content.kicker || "01 / STRATEGIC PARTNERS";
  document.getElementById("fieldHeadline").value = content.headline || "BUILDING THE FUTURE.";
  document.getElementById("fieldBrandName").value = content.brandName || "SUPPLIER PORTAL";
  document.getElementById("fieldTagline").value = content.tagline || "";
  document.getElementById("fieldOverviewKicker").value = content.overviewKicker || "";
  document.getElementById("fieldOverviewHeadline").value = content.overviewHeadline || "";
  document.getElementById("fieldOverviewBody").value = content.overviewBody || "";
  document.getElementById("fieldContactEmail").value = content.contactEmail || "suppliers@mave.africa";
  document.getElementById("fieldContactPhone").value = content.contactPhone || "";

  renderPillarsForm(content.pillars || DEFAULT_PAGE_CONTENT.pillars);
}

function renderPillarsForm(pillars) {
  const container = document.getElementById("pillarsEditGrid");
  if (!container) return;

  container.innerHTML = pillars
    .map(
      (p, i) => `
    <div style="background: rgba(14,10,7,0.4); border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-sm);">
      <div style="font-size: 11px; color: var(--gold); font-weight: 600; margin-bottom: 8px;">PILLAR ${p.code || "0" + (i + 1)}</div>
      <div class="form-group">
        <label class="form-label">Title</label>
        <input type="text" class="form-input pillar-title" data-index="${i}" value="${escapeHtml(p.title)}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea pillar-desc" data-index="${i}" style="min-height: 70px;">${escapeHtml(p.desc)}</textarea>
      </div>
    </div>
  `
    )
    .join("");
}

function setupContentForm() {
  const saveBtn = document.getElementById("saveContentBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      saveBtn.textContent = "Publishing to Firestore...";
      saveBtn.disabled = true;

      const pillars = [];
      document.querySelectorAll(".pillar-title").forEach((input, i) => {
        const descInput = document.querySelector(`.pillar-desc[data-index="${i}"]`);
        pillars.push({
          code: String(i + 1).padStart(2, "0"),
          title: input.value.trim(),
          desc: descInput ? descInput.value.trim() : ""
        });
      });

      const updated = {
        ...state.content,
        displayWord: document.getElementById("fieldDisplayWord").value.trim(),
        kicker: document.getElementById("fieldKicker").value.trim(),
        headline: document.getElementById("fieldHeadline").value.trim(),
        brandName: document.getElementById("fieldBrandName").value.trim(),
        tagline: document.getElementById("fieldTagline").value.trim(),
        overviewKicker: document.getElementById("fieldOverviewKicker").value.trim(),
        overviewHeadline: document.getElementById("fieldOverviewHeadline").value.trim(),
        overviewBody: document.getElementById("fieldOverviewBody").value.trim(),
        pillars,
        contactEmail: document.getElementById("fieldContactEmail").value.trim(),
        contactPhone: document.getElementById("fieldContactPhone").value.trim(),
        lastUpdated: new Date().toISOString()
      };

      try {
        await saveSiteContent(updated);
        showToast("✓ Portal content published live to Firestore & Portal!");
      } catch (err) {
        showToast("Error saving content: " + err.message);
      } finally {
        saveBtn.textContent = "Publish All Content Changes";
        saveBtn.disabled = false;
      }
    });
  }

  // Reset defaults
  const resetBtn = document.getElementById("resetDefaultsBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("Reset portal content and tiers to factory defaults?")) {
        await saveSiteContent(DEFAULT_PAGE_CONTENT);
        showToast("Reset to defaults complete.");
      }
    });
  }

  // Export JSON
  const exportBtn = document.getElementById("exportDataBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const dump = {
        exportedAt: new Date().toISOString(),
        content: state.content,
        tiers: state.tiers,
        submissions: state.submissions
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mureza_supplier_portal_backup_${Date.now()}.json`;
      a.click();
    });
  }

  // Save Firebase API Key locally
  const saveKeyBtn = document.getElementById("saveApiKeyBtn");
  const keyInput = document.getElementById("cfgApiKeyInput");
  if (keyInput) {
    const existing = localStorage.getItem("mureza_firebase_api_key");
    if (existing) keyInput.value = existing;
  }
  if (saveKeyBtn && keyInput) {
    saveKeyBtn.addEventListener("click", () => {
      const val = keyInput.value.trim();
      if (!val) {
        showToast("Please enter an API key");
        return;
      }
      setFirebaseApiKey(val);
      showToast("✓ Firebase API Key saved to local session!");
    });
  }
}

// ============================================================
// DEMO SEED HELPER (FOR FAST TESTING)
// ============================================================

function setupSeedDemo() {
  const seedBtn = document.getElementById("seedDemoBtn");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.textContent = "Seeding...";
      seedBtn.disabled = true;

      const sampleCompanies = [
        {
          name: "Vaal Stamping & Tooling (Pty) Ltd",
          reg: "2018/489201/07",
          country: "South Africa",
          contact: "Johan Van Der Merwe",
          email: "johan@vaalstamping.co.za",
          phone: "+27 16 980 4000",
          cat: "Body Panels, Die Stamping & Tooling",
          tier: "tier-1",
          cap: "Tier 1 automotive press line with 800-ton stamping capacity. Currently supplying structural chassis components and ready for MUREZA Villager localization."
        },
        {
          name: "Rift Valley Cable & Harness Ltd",
          reg: "KE-REG-77391",
          country: "Kenya",
          contact: "Amina Odhiambo",
          email: "amina@riftvalleycables.ke",
          phone: "+254 20 440 8122",
          cat: "High Voltage EV Wiring & Cockpit Harnesses",
          tier: "tier-2",
          cap: "Automotive wire harness assembly plant located in Athi River Special Economic Zone. Specialized in automotive copper braiding and ECU junction connectors."
        },
        {
          name: "Manica Lithium Concentrates",
          reg: "MZ-88204-IND",
          country: "Mozambique",
          contact: "Carlos Machel",
          email: "carlos@manicalithium.mz",
          phone: "+258 21 349 900",
          cat: "Battery-grade Spodumene & Lithium Salts",
          tier: "tier-3",
          cap: "Certified lithium chemical refining facility with 25,000 metric tonne annual concentrate off-take for African battery cell manufacturing."
        }
      ];

      const chosen = sampleCompanies[Math.floor(Math.random() * sampleCompanies.length)];

      // Create dummy file blob
      const dummyFile = new File(
        [`COMPANY PROFILE DOSSIER\n\nCompany: ${chosen.name}\nRegistration: ${chosen.reg}\nCapability: ${chosen.cap}`],
        `${chosen.name.replace(/[^a-z0-9]/gi, "_")}_Company_Profile.pdf`,
        { type: "application/pdf" }
      );

      try {
        const sub = await submitSupplierRegistration(
          {
            companyName: chosen.name,
            registrationNumber: chosen.reg,
            country: chosen.country,
            contactName: chosen.contact,
            contactEmail: chosen.email,
            contactPhone: chosen.phone,
            primaryCategory: chosen.cat,
            selectedTier: chosen.tier,
            capabilitySummary: chosen.cap
          },
          [dummyFile]
        );

        showToast(`✓ Seeded application: ${sub.companyName} (${sub.trackingCode})`);
      } catch (e) {
        showToast("Seed error: " + e.message);
      } finally {
        seedBtn.textContent = "+ Seed Test Application";
        seedBtn.disabled = false;
      }
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function getTierLabel(tierId) {
  if (!tierId) return "Unassigned";
  const t = state.tiers.find((tier) => tier.id === tierId || tier.code === tierId);
  return t ? t.title : tierId.toUpperCase();
}

function formatStatus(status) {
  switch (status) {
    case "pending":
      return "Pending Review";
    case "under_review":
      return "Under Review";
    case "tier_assigned":
      return "Tier Assigned";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    default:
      return (status || "Pending").toUpperCase();
  }
}

function formatCurrency(amount, currency = "ZAR") {
  const num = Number(amount) || 0;
  if (currency === "USD") return `$${num.toLocaleString()}`;
  return `R ${num.toLocaleString()}`;
}

function formatFileSize(bytes) {
  if (!bytes) return "PDF Document";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso) {
  if (!iso) return "Just now";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch (e) {
    return iso;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span>⚡</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.4s ease";
    setTimeout(() => t.remove(), 400);
  }, 4000);
}
